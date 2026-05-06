import logging
from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect
from django.template.loader import render_to_string
from django.views.decorators.csrf import csrf_exempt
from decimal import Decimal, InvalidOperation
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import Payment
from .serializers import PaymentSerializer
from .services.paymob_service import PaymobService
from orders.models import Order
from accounts.utils import get_tokens_for_customer
from messaging.models import MessageLog

logger = logging.getLogger(__name__)

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Payment.objects.none()

        is_dashboard = False
        auth = self.request.auth
        if auth is not None and hasattr(auth, 'get'):
            is_dashboard = (auth.get('user_type') == 'employee')

        qs = Payment.objects.all()
        order_id = self.request.query_params.get('order')

        if is_dashboard and (user.is_staff or hasattr(user, 'employee_profile')):
            if order_id:
                qs = qs.filter(order_id=order_id)
            return qs

        qs = qs.filter(user=user)
        if order_id:
            qs = qs.filter(order_id=order_id)
        return qs

    def _validate_amount(self, amount):
        try:
            amount_decimal = Decimal(str(amount))
            if amount_decimal <= 0:
                return None, "المبلغ غير صالح"
            return amount_decimal, None
        except (InvalidOperation, TypeError, ValueError):
            return None, "المبلغ غير صالح"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order = serializer.validated_data['order']
        amount = serializer.validated_data['amount']

        if order.user != request.user:
            return Response({"detail": "ليس لديك صلاحية الوصول لهذا الطلب"}, status=status.HTTP_403_FORBIDDEN)

        amount_decimal, error = self._validate_amount(amount)
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            payment = serializer.save(
                user=request.user,
                status='pending',
                payment_method='paymob',
                payment_type='initial'
            )

            try:
                paymob = PaymobService()
                merchant_reference = f"{order.id}_{payment.id}"

                billing_data = {
                    "email": request.user.email or "customer@example.com",
                    "first_name": request.user.first_name or request.user.full_name or "Customer",
                    "last_name": request.user.last_name or "Name",
                    "phone_number": request.user.phone or "01000000000",
                }

                animal_codes = [item.animal.code for item in order.items.all() if item.animal]
                desc_text = f"متجر لَحِم | طلب #{order.id}" + (f" | : {', '.join(animal_codes)}" if animal_codes else "")
                link_data = paymob.create_payment_link(amount_decimal, billing_data, merchant_reference, items_description=desc_text)

                payment.transaction_id = link_data["paymob_order_id"]
                payment.save()

                return Response({
                    "payment_id": payment.id,
                    "payment_url": link_data["payment_url"],
                    "status": "pending"
                }, status=status.HTTP_201_CREATED)

            except Exception as e:
                logger.error(f"Paymob Error: {str(e)}", exc_info=True)

                if settings.DEBUG:
                    return Response({
                        "payment_id": payment.id,
                        "payment_url": f"https://mock-paymob.com/pay/{payment.id}",
                        "detail": "Using mock payment URL for development"
                    }, status=status.HTTP_201_CREATED)

                payment.status = 'failed'
                payment.save()
                return Response(
                    {"detail": "فشل الاتصال ببوابة الدفع"},
                    status=status.HTTP_502_BAD_GATEWAY
                )

    @action(detail=False, methods=['post'], url_path='pay-remainder')
    def pay_remainder(self, request):
        order_id = request.data.get('order_id')
        amount = request.data.get('amount')

        if not order_id or not amount:
            return Response({"detail": "بيانات غير مكتملة"}, status=status.HTTP_400_BAD_REQUEST)

        amount_decimal, error = self._validate_amount(amount)
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)

        order = get_object_or_404(Order, id=order_id, user=request.user)

        try:
            if order.deposit_total <= 0:
                if amount_decimal < order.min_deposit_required:
                    return Response(
                        {"detail": f"الحد الأدنى لدفع العربون هو {order.min_deposit_required} ج.م"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            if Decimal(str(order.remaining_amount)) < amount_decimal:
                return Response({"detail": "المبلغ يتجاوز المبلغ المتبقي"}, status=status.HTTP_400_BAD_REQUEST)
        except (InvalidOperation, TypeError, AttributeError):
            return Response({"detail": "خطأ في حساب المبلغ المتبقي"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            payment = Payment.objects.create(
                order=order,
                user=request.user,
                amount=amount_decimal,
                payment_method='paymob',
                status='pending',
                payment_type='remainder'
            )

            try:
                paymob = PaymobService()

                merchant_reference = f"{order.id}_{payment.id}"

                billing_data = {
                    "email": request.user.email or "customer@example.com",
                    "first_name": request.user.first_name or request.user.full_name or "Customer",
                    "last_name": request.user.last_name or "Name",
                    "phone_number": request.user.phone or "01000000000",
                }

                animal_codes =[item.animal.code for item in order.items.all() if item.animal]
                desc_text = f"متجر لَحِم | طلب #{order.id}" + (f" | : {', '.join(animal_codes)}" if animal_codes else "")
                #  Payment Link    
                link_data = paymob.create_payment_link(amount_decimal, billing_data, merchant_reference, items_description=desc_text)

                payment.transaction_id = link_data["paymob_order_id"]
                payment.save()

                return Response({
                    "payment_id": payment.id,
                    "payment_url": link_data["payment_url"],
                    "status": "pending"
                })

            except Exception as e:
                logger.error(f"Paymob Remainder Error: {str(e)}", exc_info=True)
                payment.status = 'failed'
                payment.save()
                return Response(
                    {"detail": "فشل الاتصال ببوابة الدفع"},
                    status=status.HTTP_502_BAD_GATEWAY
                )

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def paymob_webhook(request):
    try:
        data = request.data

        if not isinstance(data, dict):
            return Response({"detail": "Invalid data format"}, status=status.HTTP_200_OK)

        webhook_type = data.get("type")
        if webhook_type != "TRANSACTION":
            return Response({"detail": "Ignored non-transaction webhook"}, status=status.HTTP_200_OK)

        received_hmac = request.query_params.get('hmac')
        if not received_hmac:
            return Response({"detail": "Missing HMAC"}, status=status.HTTP_200_OK)

        paymob_service = PaymobService()
        if not paymob_service.validate_hmac(data, received_hmac):
            logger.warning("Paymob Webhook HMAC validation failed")
            return Response({"detail": "Invalid signature"}, status=status.HTTP_200_OK)

        obj_data = data.get('obj', {})
        success = obj_data.get('success', False)

        merchant_order_id = str(obj_data.get('order', {}).get('merchant_order_id', ''))

        with transaction.atomic():
            payment = None
            parts = merchant_order_id.split('_')
            if len(parts) >= 2:
                try:
                    payment_id = int(parts[1])
                    payment = Payment.objects.select_for_update().get(id=payment_id)
                except (Payment.DoesNotExist, ValueError):
                    pass

            if not payment:
                paymob_order_id = str(obj_data.get('order', {}).get('id'))
                try:
                    payment = Payment.objects.select_for_update().get(transaction_id=paymob_order_id)
                except Payment.DoesNotExist:
                    return Response({"detail": "Payment not found"}, status=status.HTTP_200_OK)

            if payment.status == 'completed':
                return Response({"detail": "Payment already processed"}, status=status.HTTP_200_OK)
            if not success and payment.status == 'failed':
                return Response({"detail": "Already marked as failed"}, status=status.HTTP_200_OK)

            amount_cents_received = int(obj_data.get('amount_cents', 0))
            expected_cents = int((Decimal(str(payment.amount)) * 100).quantize(Decimal('1')))

            if success and abs(amount_cents_received - expected_cents) > 5:
                payment.status = 'failed'
                payment.save()
                logger.error(f"Amount mismatch: Expected {expected_cents}, got {amount_cents_received}")
                return Response({"detail": "Amount mismatch"}, status=status.HTTP_200_OK)

            payment.status = 'completed' if success else 'failed'

            try:
                source_data = obj_data.get('source_data', {})
                source_type = source_data.get('type', '').lower()
                source_subtype = source_data.get('sub_type', '').lower()
                pan = source_data.get('pan', '')

                is_wallet = source_type == 'wallet' or 'wallet' in source_subtype
                base_method = "محفظة" if is_wallet else "فيزا"
                suffix = "رابط SMS" if payment.payment_method == 'paymob_link' else "المتجر"

                if pan:
                    if is_wallet:
                        new_method = f"{base_method} ({pan}) - {suffix}"
                    else:
                        last4 = pan[-4:] if len(pan) >= 4 else pan
                        new_method = f"{base_method} (****{last4}) - {suffix}"
                else:
                    new_method = f"{base_method} - {suffix}"

                payment.payment_method = new_method
            except Exception as e:
                logger.error(f"Error parsing source data: {e}")

            payment.save()
            payment.order.recalc_totals(commit=True)

            if success and payment.user.email and payment.user.is_email_verified:
                try:
                    is_full_payment = payment.order.remaining_amount <= 0
                    is_b2b = payment.order.source == 'b2b'
                    display_id = payment.order.business_source.id if is_b2b and hasattr(payment.order, 'business_source') else payment.order.id
                    order_type_text = "طلب توريد شركات" if is_b2b else "طلب"

                    subject = f"فاتورة {order_type_text} رقم #{display_id}   " if is_full_payment else f"   {order_type_text} #{display_id}"
                    intro = "تم استلام دفعتك بنجاح، وطلبك الآن خالص." if is_full_payment else f"تم استلام دفعة بقيمة {payment.amount} ج.م."

                    html_content = render_to_string('emails/receipt_email.html', {
                        'name': payment.user.full_name,
                        'order': payment.order,
                        'intro_text': intro,
                        'site_url': 'https://lahmfarm.com'
                    })
                    msg = EmailMultiAlternatives(
                        subject=subject,
                        body=intro,
                        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'متجر لَحِم <info@lahmfarm.com>'),
                        to=[payment.user.email]
                    )
                    msg.attach_alternative(html_content, "text/html")
                    msg.send(fail_silently=True)

                    MessageLog.objects.create(
                        recipient=payment.user.email,
                        content=f"تم إرسال {subject}",
                        message_type='EMAIL',
                        status='sent'
                    )
                except Exception as e:
                    logger.error(f"Failed to send receipt email: {e}")

        return Response({"detail": "Webhook processed successfully"}, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Webhook error: {str(e)}", exc_info=True)
        return Response({"detail": "Internal server error"}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def paymob_callback(request):
    success = request.query_params.get('success')
    paymob_order_id = request.query_params.get('order')

    frontend_domain = 'https://lahmfarm.com'
    if settings.DEBUG:
        frontend_domain = 'http://localhost:5173'

    params = {'payment': 'success' if success == 'true' else 'failed'}
    frontend_url = f"{frontend_domain}/my-orders"

    if paymob_order_id:
        try:
            payment = Payment.objects.filter(transaction_id=str(paymob_order_id)).first()
            if payment:
                is_link = payment.payment_method == 'paymob_link' or 'رابط' in payment.payment_method
                if is_link:
                    if success in ('true', 'True'):
                        tokens = get_tokens_for_customer(payment.user)
                        receipt_url = f"/api/orders/receipt/{payment.order.id}/?token={tokens['access']}"
                        return redirect(receipt_url)
                    else:
                        return redirect(f"{frontend_domain}/")

                params['order_id'] = payment.order.id
                if payment.order.source == 'b2b':
                    frontend_url = f"{frontend_domain}/business"
        except Exception as e:
            logger.error(f"Callback error: {e}")

    redirect_url = f"{frontend_url}?{urlencode(params)}"
    return redirect(redirect_url)
