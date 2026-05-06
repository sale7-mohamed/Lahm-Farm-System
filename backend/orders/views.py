from decimal import Decimal
from datetime import date
import random
from rest_framework_simplejwt.tokens import AccessToken
from django.http import HttpResponseForbidden
from django.db import transaction
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

from .models import Order, OrderItem, SpecialRequest, Shipment, BusinessRequest
from .serializers import (
    OrderSerializer,
    CustomerSpecialRequestSerializer,
    ShipmentSerializer,
    BusinessRequestSerializer,
)
from .services import PricingService
from cart.models import Cart
from livestock.models import (
    Animal,
    DeliverySetting,
    AnimalListing,
    ServicePriceSetting,
    DeliveryArea,
    AdahiGroup,
)
from accounts.models import Address, User as CustomerUser
from accounts.permissions import IsCustomerUser
from core.models import OperationSettings
from management.permissions import IsManagementUser
from management.models import Employee, Supplier, WeightLog
from management.utils import normalize_phone
from management.serializers import ManagementOrderSerializer
from payments.models import Payment
from livestock.utils.watermark import apply_video_watermark
from messaging.services import MessagingService
from messaging.models import MessageLog

try:
    from notifications.utils import send_notification, send_admin_notification
except ImportError:
    send_notification = None
    send_admin_notification = None

DEPOSIT_FALLBACK_PERCENT = Decimal("0.20")

def is_order_ready_for_processing(order):
    for item in order.items.all():
        if item.listing_section in ["adahi_pool", "adahi_group", "shares"]:
            if item.animal.remaining_shares > 0:
                return False
    return True

def is_authorized_for_print(request, order_user_id=None, require_employee=False):
    token = request.GET.get("token")
    if not token and "HTTP_AUTHORIZATION" in request.META:
        auth_header = request.META.get("HTTP_AUTHORIZATION")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if not token:
        return False
    try:
        access_token = AccessToken(token)
        user_type = access_token.get("user_type")
        user_id = access_token.get("user_id")
        if user_type == "employee":
            return True
        if not require_employee and user_type == "customer" and str(user_id) == str(order_user_id):
            return True
    except Exception:
        return False
    return False

def invoice_view(request, order_id):
    order = get_object_or_404(
        Order.objects.select_related("user", "delivery_address", "created_by_employee").prefetch_related(
            "items__animal__category", "payments"
        ),
        id=order_id,
    )
    if not is_authorized_for_print(request, order.user.id):
        return HttpResponseForbidden("غير مصرح لك بعرض هذه الفاتورة.")
    context = {
        "order": order,
        "completed_payments": order.payments.filter(status="completed").order_by("created_at"),
    }
    return render(request, "orders/invoice.html", context)

def receipt_view(request, order_id):
    order = get_object_or_404(Order, id=order_id)
    if not is_authorized_for_print(request, order.user.id):
        return HttpResponseForbidden("غير مصرح لك بعرض هذا الإيصال.")
    payments = order.payments.filter(status="completed").order_by("created_at")
    context = {"order": order, "payments": payments}
    return render(request, "orders/receipt.html", context)

def delivery_note_view(request, order_id):
    order = get_object_or_404(
        Order.objects.select_related("user", "delivery_address").prefetch_related("items__animal__category"),
        id=order_id,
    )
    if not is_authorized_for_print(request, order.user.id):
        return HttpResponseForbidden("غير مصرح لك بعرض إذن الاستلام.")
    context = {"order": order}
    return render(request, "orders/delivery_note.html", context)

def bulk_print_view(request):
    if not is_authorized_for_print(request, require_employee=True):
        return HttpResponseForbidden("غير مصرح لك بالطباعة المجمعة.")
    order_ids = request.GET.get("ids", "")
    ids_list = [int(id) for id in order_ids.split(",") if id.isdigit()]
    orders = (
        Order.objects.filter(id__in=ids_list)
        .select_related("user", "delivery_address")
        .prefetch_related("items__animal__category", "payments")
    )
    print_jobs = []
    for order in orders:
        completed_payments = order.payments.filter(status="completed").order_by("created_at")
        print_jobs.append({"type": "delivery_note", "order": order})
        print_jobs.append({"type": "invoice", "order": order, "payments": completed_payments})
        if order.deposit_total > 0 and order.remaining_amount > 0:
            print_jobs.append({"type": "receipt", "order": order, "payments": completed_payments})
    context = {"print_jobs": print_jobs}
    return render(request, "orders/bulk_print.html", context)

def _calc_deposit_for_animal(animal, price_fallback: Decimal) -> Decimal:
    dep = getattr(animal, "deposit_egp", None)
    if dep is not None and dep > 0:
        return Decimal(dep)
    delivery_setting = DeliverySetting.objects.first()
    deposit_percentage = DEPOSIT_FALLBACK_PERCENT
    if delivery_setting:
        deposit_percentage = delivery_setting.min_deposit_percentage
    return (price_fallback * deposit_percentage).quantize(Decimal("0.01"))

class OrderViewSet(viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status"]

    def get_queryset(self):
        qs = (
            Order.objects.filter(user=self.request.user)
            .select_related("user", "created_by_employee", "delivery_address")
            .prefetch_related("items__animal")
            .order_by("-created_at")
        )
        if self.action == "list":
            qs = qs.exclude(source="b2b")
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    def create(self, request, *args, **kwargs):
        return Response(
            {"detail": "استخدم /orders/checkout/ لإنشاء طلب من الكارت."},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    @action(detail=False, methods=["post"], url_path="checkout")
    @transaction.atomic
    def checkout(self, request):
        user = request.user
        try:
            cart = (
                Cart.objects.select_for_update().prefetch_related("items__animal__category").get(user=user)
            )
            cart_items = list(cart.items.all())
        except Cart.DoesNotExist:
            return Response({"detail": "السلة فارغة."}, status=status.HTTP_400_BAD_REQUEST)

        if not cart_items:
            return Response({"detail": "لا توجد عناصر في السلة."}, status=status.HTTP_400_BAD_REQUEST)

        if len(cart_items) > 3:
            return Response(
                {"detail": "الحد الأقصى للطلب الواحد هو 3 حيوانات فقط."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.is_authenticated:
            if getattr(user, 'is_restricted', False):
                from management.models import CustomerSuspensionLog

                last_restriction = CustomerSuspensionLog.objects.filter(customer=user, action='restricted').order_by('-created_at').first()

                #   24  (86400 )    
                if last_restriction and (timezone.now() - last_restriction.created_at).total_seconds() > 24 * 3600:
                    user.is_restricted = False
                    user.restriction_reason = ""
                    user.last_cancel_reset_at = timezone.now()
                    user.save(update_fields=['is_restricted', 'restriction_reason', 'last_cancel_reset_at'])
                    CustomerSuspensionLog.objects.create(
                        customer=user,
                        action='unrestricted',
                        reason='النظام: فك التقييد تلقائياً لمرور 24 ساعة',
                        changed_by=None
                    )
                else:
                    return Response(
                        {"detail": f"حسابك مقيد من إنشاء الطلبات. {user.restriction_reason or ''}"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            today = timezone.localtime(timezone.now()).date()
            from datetime import datetime
            start_of_day = timezone.make_aware(datetime.combine(today, datetime.min.time()))

            query_start_time = start_of_day
            if user.last_cancel_reset_at and user.last_cancel_reset_at >= start_of_day:
                query_start_time = user.last_cancel_reset_at

            canceled_unpaid_today = Order.objects.filter(
                user=user,
                created_at__gte=query_start_time,
                status="canceled",
                deposit_total=0
            ).count()

            if canceled_unpaid_today >= 3:
                if not user.is_restricted:
                    user.is_restricted = True
                    user.restriction_reason = "النظام: تقييد تلقائي لتجاوز الحد اليومي لإلغاء الطلبات المتكرر."
                    user.save(update_fields=['is_restricted', 'restriction_reason'])
                    from management.models import CustomerSuspensionLog
                    CustomerSuspensionLog.objects.create(
                        customer=user,
                        action='restricted',
                        reason=user.restriction_reason,
                        changed_by=None
                    )

                return Response(
                    {
                        "detail": "تم تقييد حسابك مؤقتاً لتجاوز الحد المسموح للإلغاء المتكرر. لا يمكنك إنشاء طلبات جديدة، يرجى التواصل مع خدمة العملاء.",
                        "error_code": "daily_limit_exceeded",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            existing_pending = Order.objects.filter(
                user=user, status="pending", source="online_store"
            ).first()

            if existing_pending:
                return Response(
                    {
                        "detail": f"لديك طلب معلق حالياً (رقم #{existing_pending.id}).             ."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        delivery_type = request.data.get("delivery_type", "pickup")
        delivery_address_id = request.data.get("delivery_address_id")
        new_address_data = request.data.get("new_address_data")
        delivery_date_str = request.data.get("delivery_date")
        payment_method = request.data.get("payment_method", "cash")
        payment_type = request.data.get("payment_type", "deposit")
        items_prefs = request.data.get("items_prefs", {})
        items_services = request.data.get("items_services", {})

        is_shared_cart = False
        for item in cart_items:
            context = item.selected_services.get("_order_context", "")
            if context in ["shares", "adahi_pool", "adahi_group"]:
                max_shares = item.animal.category.default_max_shares if item.animal.category else 1
                if item.share_quantity < max_shares:
                    is_shared_cart = True
                    break

        delivery_date = None
        if delivery_date_str:
            try:
                delivery_date = date.fromisoformat(delivery_date_str)
            except (ValueError, TypeError):
                raise ValidationError({"detail": "صيغة تاريخ التسليم غير صحيحة."})
        elif delivery_type == "pickup" and not delivery_date_str:
            delivery_date = None if is_shared_cart else date.today()
        elif not delivery_date_str:
            if not is_shared_cart:
                raise ValidationError({"detail": "يجب تحديد تاريخ التوصيل."})

        delivery_address_instance = None
        delivery_fee = Decimal("0.00")

        if delivery_type == "delivery":
            if delivery_address_id and delivery_address_id != "new_address":
                try:
                    delivery_address_instance = Address.objects.get(id=delivery_address_id, user=user)
                except Address.DoesNotExist:
                    raise ValidationError({"detail": "العنوان المحدد غير صحيح أو لا يخص هذا العميل."})
            elif new_address_data and isinstance(new_address_data, dict):
                if not all(k in new_address_data for k in ["governorate", "city", "street"]):
                    raise ValidationError({"detail": "بيانات العنوان الجديد غير مكتملة."})
                delivery_address_instance = Address.objects.create(user=user, **new_address_data)
                if user.addresses.count() == 1:
                    delivery_address_instance.is_default = True
                    delivery_address_instance.save()
            else:
                raise ValidationError({"detail": "يجب اختيار أو إضافة عنوان للتوصيل."})

            area = DeliveryArea.objects.filter(
                governorate__name_ar=delivery_address_instance.governorate
            ).first()
            if area:
                base_fee = area.delivery_price
                extra_fee = Decimal("0.00")
                for cart_item in cart_items:
                    cat = cart_item.animal.category
                    cat_extra_fee = Decimal(str(cat.extra_delivery_fee or 0))
                    context = cart_item.selected_services.get("_order_context", "general")
                    if cart_item.pipeline == "M" or context in ["general", "adahi", "adahi_full"]:
                        extra_fee += cat_extra_fee
                    else:
                        max_shares = Decimal(str(cat.default_max_shares or 1))
                        shares = Decimal(str(cart_item.share_quantity or 1))
                        extra_fee += cat_extra_fee * (shares / max_shares)
                delivery_fee = base_fee + extra_fee

        delivery_settings = DeliverySetting.objects.first()
        if not delivery_settings:
            raise ValidationError({"detail": "لم يتم تكوين إعدادات التوصيل بعد."})

        operation_settings = OperationSettings.load()

        order_animal_price = Decimal("0.00")
        order_service_cost = Decimal("0.00")
        has_slaughter_service = False
        order_items_data = []

        for cart_item in cart_items:
            try:
                animal = Animal.objects.select_for_update().get(id=cart_item.animal.id)
            except Animal.DoesNotExist:
                transaction.set_rollback(True)
                return Response(
                    {"detail": f"الحيوان {cart_item.animal.code} لم يعد موجوداً."}, status=400
                )

            if animal.is_hidden_from_store or animal.status != "available":
                transaction.set_rollback(True)
                return Response(
                    {"detail": f"الحيوان {animal.code} غير متاح للشراء حالياً."}, status=400
                )

            saved_services = cart_item.selected_services or {}
            new_services = items_services.get(str(animal.id), {})
            final_services = {**saved_services, **new_services}
            current_context = final_services.get("_order_context", "general")
            required_section = None
            if current_context == "general":
                required_section = "full_sale"
            elif current_context == "adahi":
                required_section = "adahi_full"
            elif current_context == "shares":
                required_section = "shares"
            elif current_context == "adahi_pool":
                required_section = "adahi_pool"
            elif current_context == "adahi_group":
                required_section = "adahi_group"

            is_group_creator = final_services.get("is_group_creator", False)
            pipeline = "S" if current_context in ["adahi", "adahi_pool", "adahi_group"] else cart_item.pipeline

            if current_context == "adahi_group" and is_group_creator:
                listing = (
                    AnimalListing.objects.filter(animal=animal, pipeline="S", section="adahi_group")
                    .select_for_update()
                    .first()
                )
                if not listing:
                    listing = AnimalListing.objects.create(
                        animal=animal,
                        pipeline="S",
                        section="adahi_group",
                        price=animal.price_after_discount,
                        total_shares=7,
                        available_shares=7,
                        is_active=True,
                    )
                else:
                    listing.is_active = True
                    listing.price = animal.price_after_discount
                    listing.save(update_fields=["is_active", "price"])

                if listing.available_shares < cart_item.share_quantity:
                    transaction.set_rollback(True)
                    return Response(
                        {
                            "detail": f"عذراً، الأسهم المتبقية ({listing.available_shares}) غير كافية لطلبك."
                        },
                        status=400,
                    )

                AnimalListing.objects.filter(animal=animal, is_active=True).exclude(id=listing.id).update(
                    is_active=False
                )
            else:
                listing = (
                    AnimalListing.objects.filter(
                        animal=animal, pipeline=pipeline, section=required_section, is_active=True
                    )
                    .select_for_update()
                    .first()
                )
                if not listing:
                    transaction.set_rollback(True)
                    return Response(
                        {"detail": f"هذا العرض ({current_context}) غير متاح حالياً لهذا الحيوان."},
                        status=400,
                    )
                if listing.available_shares < cart_item.share_quantity:
                    transaction.set_rollback(True)
                    return Response(
                        {
                            "detail": f"عذراً، الأسهم المتبقية ({listing.available_shares}) غير كافية لطلبك."
                        },
                        status=400,
                    )

            pref = final_services.get("extra_parts_preference", items_prefs.get(str(animal.id), "receive"))
            b_notes = final_services.get("butcher_notes", "")

            calculation = PricingService.calculate_item_price(
                animal=animal,
                share_qty=cart_item.share_quantity,
                services=final_services,
                user=user,
                pipeline=pipeline,
                section=required_section,
            )

            final_services["_discount_source"] = calculation.get("discount_source", "none")
            final_services["_discount_amount"] = float(calculation.get("discount_amount", 0))

            order_animal_price += calculation["final_item_price"]
            order_service_cost += calculation["service_cost"]

            if final_services.get("slaughter"):
                has_slaughter_service = True

            request_video = final_services.get("request_video", False)

            order_items_data.append(
                {
                    "animal": animal,
                    "pipeline": pipeline,
                    "listing_section": required_section,
                    "price_per_item": calculation["final_item_price"],
                    "deposit_per_item": calculation["deposit_amount"],
                    "service_cost": calculation["service_cost"],
                    "share_quantity": cart_item.share_quantity,
                    "extra_parts_preference": pref,
                    "selected_services": final_services,
                    "request_slaughter_video": request_video,
                }
            )

        order_service_cost += delivery_fee
        order_notes = request.data.get("notes", "")
        if is_shared_cart:
            order_notes = (
                (order_notes or "")
                + "\n[نظام]: طلب تشارك (أسهم) - موعد الاستلام يحدد لاحقاً بعد اكتمال الماشية."
            )

        #    service_cost         
        order = Order.objects.create(
            user=user,
            status="pending",
            delivery_type=delivery_type,
            delivery_address=delivery_address_instance,
            delivery_date=delivery_date,
            payment_method=payment_method,
            source="online_store",
            notes=order_notes,
            pricing_model=operation_settings.pricing_model,
            service_cost=order_service_cost
        )

        items_deposit_sum = Decimal("0.00")

        for item_data in order_items_data:
            animal_instance = item_data["animal"]
            items_deposit_sum += (item_data["deposit_per_item"] * item_data["share_quantity"])
            OrderItem.objects.create(order=order, **item_data)

            if item_data["listing_section"] in ["full_sale", "adahi_full"]:
                animal_instance.status = "reserved"
                animal_instance.save(update_fields=["status"])

        order.recalc_totals(commit=True)

        amount_to_pay_now = Decimal("0.00")
        if payment_type == "full":
            amount_to_pay_now = order.total_price
        else:
            amount_to_pay_now = items_deposit_sum + delivery_fee
            amount_to_pay_now = min(amount_to_pay_now, order.total_price)

        cart.items.all().delete()

        payment_url = None
        payment = None

        if amount_to_pay_now > 0 and payment_method == "paymob":
            try:
                payment = Payment.objects.create(
                    order=order,
                    user=user,
                    amount=amount_to_pay_now,
                    payment_method="paymob",
                    status="pending",
                )
                from payments.services.paymob_service import PaymobService
                paymob = PaymobService()
                merchant_order_id = f"{order.id}_{payment.id}"
                full_name_parts = user.full_name.split() if user.full_name else ["NA"]
                billing_data = {
                    "email": user.email or "customer@lahmfarm.com",
                    "first_name": full_name_parts[0] if full_name_parts else "NA",
                    "last_name": " ".join(full_name_parts[1:]) if len(full_name_parts) > 1 else "NA",
                    "phone_number": user.phone or "01000000000",
                }
                animal_codes = [item_data["animal"].code for item_data in order_items_data if item_data.get("animal")]
                items_desc = f"متجر لَحِم | طلب #{order.id}" + (f" | : {', '.join(animal_codes)}" if animal_codes else "")
                link_data = paymob.create_payment_link(amount_to_pay_now, billing_data, merchant_order_id, items_description=items_desc)
                payment.transaction_id = link_data["paymob_order_id"]
                payment.save()
                payment_url = link_data["payment_url"]
            except Exception as e:
                if payment:
                    payment.status = "failed"
                    payment.save(update_fields=["status"])

        if send_admin_notification:
            send_admin_notification(
                title=f"طلب جديد #{order.id}",
                message=f"تم استلام طلب جديد من {user.username}.",
                category="order",
            )

        data = OrderSerializer(order, context={"request": request}).data
        if payment_url:
            data["payment_url"] = payment_url

        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='record-payment')
    @transaction.atomic
    def record_payment(self, request, pk=None):
        order = Order.objects.select_for_update().get(pk=self.get_object().pk)
        amount_str = request.data.get('amount', '0')
        payment_method = request.data.get('payment_method', 'cash')

        try:
            amount = Decimal(str(amount_str))
        except Exception:
            return Response({"detail": "صيغة المبلغ غير صالحة."}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0 or amount > order.remaining_amount:
            return Response({"detail": "المبلغ غير صالح."}, status=status.HTTP_400_BAD_REQUEST)

        if payment_method == 'paymob_link':
            payment = Payment.objects.create(
                order=order, user=order.user,
                amount=amount,
                payment_method='paymob_link',
                status='pending',
                payment_type='initial' if order.deposit_total == 0 else 'remainder',
                recorded_by=request.user
            )
            try:
                from payments.services.paymob_service import PaymobService
                from messaging.services import MessagingService
                paymob = PaymobService()

                merchant_ref = f"{order.id}_{payment.id}"
                animal_codes = [item.animal.code for item in order.items.all() if item.animal]
                items_desc = f"مواشي: {', '.join(animal_codes)}" if animal_codes else f"دفع طلب #{order.id}"

                billing_data = {
                    "first_name": order.user.full_name or "Customer",
                    "phone_number": order.user.phone or "01000000000",
                    "email": order.user.email or "info@lahmfarm.com",
                }

                link_data = paymob.create_quick_link(amount, billing_data, merchant_ref, items_description=items_desc)
                payment.transaction_id = link_data["paymob_order_id"]
                payment.save()

                if order.user.phone:
                    first_name = order.user.full_name.split()[0] if order.user.full_name else "عميلنا"
                    sms_text = f"مرحباً {first_name}، لدفع مبلغ ({amount} ج.م) لطلبك رقم #{order.id}    :\n{link_data['payment_url']}"
                    MessagingService.send_message(phone=order.user.phone, content=sms_text, msg_type='AUTOMATED', user=request.user)
                return Response({"detail": "تم إنشاء رابط الدفع وإرساله للعميل في SMS بنجاح.", "status": order.status})
            except Exception as e:
                payment.status = 'failed'
                payment.save()
                return Response({"detail": "فشل إنشاء رابط الدفع."}, status=status.HTTP_400_BAD_REQUEST)

        Payment.objects.create(
            order=order,
            user=order.user,
            amount=amount,
            payment_method=payment_method,
            status='completed',
            payment_type='initial' if order.deposit_total == 0 else 'remainder',
            transaction_id=f"MANUAL-{order.id}-{int(timezone.now().timestamp())}",
            recorded_by=request.user
        )
        order.recalc_totals(commit=True)
        return Response({
            "detail": "تم تسجيل الدفعة بنجاح.",
            "status": order.status,
            "remaining_amount": order.remaining_amount,
            "deposit_total": order.deposit_total
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="send-payment-link")
    @transaction.atomic
    def send_payment_link(self, request, pk=None):
        order = self.get_object()
        if order.user != request.user and not request.user.is_staff:
            return Response({"detail": "غير مصرح لك بإرسال رابط الدفع."}, status=status.HTTP_403_FORBIDDEN)

        amount = request.data.get("amount")
        if not amount:
            return Response({"detail": "المبلغ مطلوب."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            amount = Decimal(str(amount))
        except Exception:
            return Response({"detail": "المبلغ غير صالح."}, status=status.HTTP_400_BAD_REQUEST)

        payment_method = request.data.get("payment_method", "paymob_link")
        if payment_method != "paymob_link":
            return Response({"detail": "طريقة الدفع غير مدعومة."}, status=status.HTTP_400_BAD_REQUEST)

        payment = Payment.objects.create(
            order=order,
            user=order.user,
            amount=amount,
            payment_method='paymob_link',
            status='pending',
            payment_type='initial' if order.deposit_total == 0 else 'remainder',
            recorded_by=request.user
        )
        try:
            from payments.services.paymob_service import PaymobService
            from messaging.services import MessagingService
            paymob = PaymobService()

            merchant_ref = f"{order.id}_{payment.id}"
            animal_codes =[item.animal.code for item in order.items.all() if item.animal]
            items_desc = f"مواشي: {', '.join(animal_codes)}" if animal_codes else f"دفع طلب #{order.id}"

            billing_data = {
                "first_name": order.user.full_name.split()[0] if order.user.full_name else "عميلنا",
                "last_name": "NA",
                "phone_number": order.user.phone or "01000000000",
                "email": order.user.email or "info@lahmfarm.com",
            }

            link_data = paymob.create_quick_link(amount, billing_data, merchant_ref, items_desc)
            payment.transaction_id = link_data["paymob_order_id"]
            payment.save()

            if order.user.phone:
                first_name = order.user.full_name.split()[0] if order.user.full_name else "عميلنا"
                sms_text = f"مرحباً {first_name}، لدفع مبلغ ({amount} ج.م) لطلبك رقم #{order.id}    :\n{link_data['payment_url']}"
                MessagingService.send_message(phone=order.user.phone, content=sms_text, msg_type='AUTOMATED', user=request.user)

            return Response({"detail": "تم إنشاء رابط الدفع وإرساله للعميل في SMS بنجاح.", "status": order.status})
        except Exception as e:
            payment.status = 'failed'
            payment.save()
            return Response({"detail": "فشل إنشاء رابط الدفع."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="confirm")
    @transaction.atomic
    def confirm(self, request, pk=None):
        order = self.get_object()
        if order.user != request.user and not request.user.is_staff:
            return Response(
                {"detail": "غير مصرح لك بتأكيد هذا الطلب."}, status=status.HTTP_403_FORBIDDEN
            )

        if order.status == "completed":
            return Response({"detail": "الطلب مؤكد بالفعل."}, status=status.HTTP_400_BAD_REQUEST)
        if order.status == "canceled":
            return Response({"detail": "لا يمكن تأكيد طلب ملغي."}, status=status.HTTP_400_BAD_REQUEST)
        if order.deposit_total < order.min_deposit_required:
            return Response(
                {"detail": "لا يمكنك تأكيد الطلب قبل دفع العربون."}, status=status.HTTP_400_BAD_REQUEST
            )

        order.status = "confirmed"
        has_external = any(item.animal.source_farm is not None for item in order.items.all())
        if has_external:
            order.notes = (order.notes or "") + "\n[نظام ذكي: يتطلب الجلب من مزرعة المورد]"
        order.save(update_fields=["status", "notes"])

        for item in order.items.select_related("animal"):
            if item.listing_section in ["full_sale", "adahi_full"]:
                item.animal.status = "sold"
                item.animal.save(update_fields=["status"])
            else:
                if item.animal.remaining_shares <= 0:
                    item.animal.status = "sold"
                    item.animal.save(update_fields=["status"])

        return Response(
            OrderSerializer(order, context={"request": request}).data, status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["post"], url_path="cancel")
    @transaction.atomic
    def cancel(self, request, pk=None):
        order = self.get_object()

        if order.user != request.user:
            return Response(
                {"detail": "غير مصرح لك بإلغاء هذا الطلب."}, status=status.HTTP_403_FORBIDDEN
            )

        if order.status != "pending":
            return Response(
                {
                    "detail": "لا يمكنك إلغاء الطلب آلياً لأنه تم دفع العربون وتأكيده. يرجى التواصل مع خدمة العملاء."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        order.status = "canceled"
        time_now = timezone.localtime(timezone.now()).strftime("%Y-%m-%d %I:%M %p")
        log_entry = f"\n[نظام - {time_now}]: ألغى العميل الطلب بنفسه."
        order.notes = (order.notes or "") + log_entry
        order.save(update_fields=["status", "notes"])

        if order.source == "b2b" and hasattr(order, "business_source") and order.business_source:
            b_req = order.business_source
            b_req.status = "rejected"
            b_req.admin_notes = (b_req.admin_notes or "") + log_entry
            b_req.save(update_fields=["status", "admin_notes"])

        for item in order.items.select_related("animal").all():
            animal = item.animal
            services = item.selected_services or {}

            if services.get("is_group_creator") and item.listing_section == "adahi_group":
                AdahiGroup.objects.filter(listing__animal=animal, created_by=order.user).delete()
                AnimalListing.objects.filter(animal=animal, section="adahi_group").update(is_active=False)

            elif item.listing_section:
                listing = (
                    AnimalListing.objects.select_for_update()
                    .filter(animal=animal, pipeline=item.pipeline, section=item.listing_section)
                    .first()
                )
                if listing:
                    listing.available_shares += item.share_quantity
                    listing.is_active = True
                    listing.save(update_fields=["available_shares", "is_active"])

            if not animal.has_partial_sales():
                animal.status = "available"
                animal.first_sale_at = None
                animal.save(update_fields=["status", "first_sale_at"])

                paused_listings = AnimalListing.objects.filter(animal=animal, paused_due_to_order=True)
                for pl in paused_listings:
                    pl.is_active = True
                    pl.paused_due_to_order = False
                    if pl.available_shares == 0:
                        pl.available_shares = pl.total_shares
                    pl.save(update_fields=["is_active", "paused_due_to_order", "available_shares"])

        return Response(
            OrderSerializer(order, context={"request": request}).data, status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["post"], url_path="status")
    def update_status(self, request, pk=None):
        order = self.get_object()
        is_dashboard = False
        if request.auth and hasattr(request.auth, "get"):
            is_dashboard = request.auth.get("user_type") == "employee"
        if not is_dashboard:
            return Response(
                {"detail": "غير مصرح لك بتحديث حالة الطلب من المتجر."},
                status=status.HTTP_403_FORBIDDEN,
            )

        new_status = request.data.get("status")
        allowed_status = [
            "pending",
            "preparing",
            "shipped",
            "delivered",
            "completed",
            "canceled",
            "processing",
            "ready_for_shipment",
            "out_for_delivery",
        ]
        if new_status not in allowed_status:
            return Response(
                {"detail": f"الحالة يجب أن تكون واحدة من: {allowed_status}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_status in [
            "processing",
            "ready_for_shipment",
            "out_for_delivery",
            "shipped",
            "delivered",
            "completed",
        ]:
            for item in order.items.all():
                if item.listing_section in ["adahi_pool", "adahi_group", "shares"]:
                    if item.animal.remaining_shares > 0:
                        return Response(
                            {
                                "detail": f"❌ لا يمكن تحويل الطلب إلى ({new_status}). الحيوان #{item.animal.code}    ( {item.animal.remaining_shares} )."
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )

        order.status = new_status
        order.save(update_fields=["status"])
        return Response(
            OrderSerializer(order, context={"request": request}).data, status=status.HTTP_200_OK
        )

class SpecialRequestViewSet(viewsets.ModelViewSet):
    serializer_class = CustomerSpecialRequestSerializer
    permission_classes = [IsCustomerUser]

    def get_queryset(self):
        return (
            SpecialRequest.objects.filter(user=self.request.user)
            .select_related("sourced_animal__category")
            .order_by("-created_at")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class ShipmentViewSet(viewsets.ModelViewSet):
    queryset = (
        Shipment.objects.all()
        .select_related("supervisor", "vehicle")
        .prefetch_related("orders")
        .order_by("-date")
    )
    serializer_class = ShipmentSerializer
    permission_classes = [IsManagementUser]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        order_ids = request.data.pop("order_ids", [])
        shipment_type = request.data.get("shipment_type", "delivery")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        shipment = serializer.save(status="out_for_delivery")

        if order_ids:
            orders = Order.objects.filter(id__in=order_ids).select_related(
                "delivery_address", "user"
            )
            orders.update(shipment=shipment)

            if shipment_type == "delivery":
                orders.update(status="out_for_delivery")
            elif shipment_type == "pickup":
                orders.update(status="processing")
            elif shipment_type == "slaughter":
                orders.update(status="processing")

            if not shipment.route_plan:
                route_plan = []
                for order in orders:
                    if shipment_type == "delivery":
                        address = (
                            f"{order.delivery_address.governorate} - {order.delivery_address.city} - {order.delivery_address.street}"
                            if order.delivery_address
                            else "بدون عنوان"
                        )
                        route_plan.append(
                            {
                                "type": "delivery",
                                "address": f"توصيل للعميل: {order.user.full_name} | {address}",
                                "order_id": order.id,
                            }
                        )
                    elif shipment_type == "pickup":
                        route_plan.append(
                            {"type": "pickup", "address": "جلب ماشية من المورد", "order_id": order.id}
                        )
                    elif shipment_type == "slaughter":
                        route_plan.append(
                            {"type": "slaughter", "address": "توصيل للمجزر", "order_id": order.id}
                        )

                shipment.route_plan = route_plan
                shipment.save(update_fields=["route_plan"])

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=["post"], url_path="complete")
    @transaction.atomic
    def complete_shipment(self, request, pk=None):
        shipment = self.get_object()
        shipment.status = "completed"
        shipment.save()

        op_settings = OperationSettings.load()

        for order in shipment.orders.all():
            if shipment.shipment_type == "pickup":
                order.status = (
                    "processing"
                    if order.has_slaughter_service
                    else ("packaging" if op_settings.enable_fridge_manager else "ready_for_shipment")
                )
                order.notes = (order.notes or "") + f"\n[تم جلب الحيوان من المورد عبر رحلة #{shipment.id}]"
            elif shipment.shipment_type == "slaughter":
                order.status = (
                    "packaging" if op_settings.enable_fridge_manager else "ready_for_shipment"
                )
                order.notes = (order.notes or "") + f"\n[تم الذبح الخارجي عبر رحلة #{shipment.id}]"
            order.shipment = None
            order.save()

        return Response({"status": "Shipment completed"})

    @action(detail=False, methods=["get"], url_path="my-active-shipments")
    def my_active_shipments(self, request):
        user = request.user
        if not (user.is_staff or hasattr(user, "employee_profile")):
            return Response({"detail": "غير مصرح لك."}, status=status.HTTP_403_FORBIDDEN)

        active_shipments = Shipment.objects.filter(
            supervisor=user, status__in=["pending", "out_for_delivery"]
        ).order_by("-date")

        serializer = self.get_serializer(active_shipments, many=True)
        return Response(serializer.data)

class BusinessRequestViewSet(viewsets.ModelViewSet):
    serializer_class = BusinessRequestSerializer

    def get_permissions(self):
        if self.action in ["create", "list", "retrieve", "update_delivery"]:
            return [IsAuthenticated()]
        return [IsManagementUser()]

    def get_queryset(self):
        user = self.request.user
        qs = (
            BusinessRequest.objects.all()
            .select_related("user", "created_by", "converted_order")
            .order_by("-created_at")
        )

        for req in qs:
            if req.converted_order and req.converted_order.status == "canceled" and req.status != "rejected":
                req.status = "rejected"
                req.save(update_fields=["status"])

        is_dashboard = False
        if self.request.auth and hasattr(self.request.auth, "get"):
            is_dashboard = self.request.auth.get("user_type") == "employee"

        if not (is_dashboard and (user.is_staff or getattr(user, "employee_profile", None) is not None)):
            qs = qs.filter(user=user)

        status_filter = self.request.query_params.get("status")
        search_query = self.request.query_params.get("search")

        if status_filter and status_filter != "all":
            qs = qs.filter(status=status_filter)

        if search_query:
            from django.db.models import Q
            qs = qs.filter(
                Q(user__full_name__icontains=search_query)
                | Q(user__phone__icontains=search_query)
                | Q(user__business_name__icontains=search_query)
                | Q(id__icontains=search_query)
            )

        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        is_dashboard = False
        if request.auth and hasattr(request.auth, "get"):
            is_dashboard = request.auth.get("user_type") == "employee"

        target_user = request.user
        creator_employee = None

        if is_dashboard:
            user_phone = request.data.get("user_phone")
            if not user_phone:
                return Response(
                    {"detail": "يجب تحديد رقم هاتف العميل."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            norm_phone = normalize_phone(user_phone)
            target_user = CustomerUser.objects.filter(phone=norm_phone).first()
            if not target_user:
                return Response(
                    {"detail": "العميل غير موجود."}, status=status.HTTP_404_NOT_FOUND
                )
            creator_employee = request.user
        else:
            if not target_user.is_corporate:
                return Response(
                    {"detail": "هذه الخدمة متاحة لحسابات الشركات فقط."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            creator_employee = getattr(target_user, "employee_profile", None)

        settings = OperationSettings.load()
        details = request.data.get("request_details", [])
        total_qty = sum(int(item.get("quantity", 0)) for item in details if isinstance(item, dict))

        if total_qty < settings.min_business_order_quantity:
            return Response(
                {
                    "detail": f"أقل كمية للطلب هي {settings.min_business_order_quantity} رأس. أنت طلبت {total_qty} فقط."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        quoted_price = request.data.get("quoted_total_price")
        quoted_deposit = request.data.get("quoted_deposit")
        req_status = request.data.get("status", "pending")

        business_req = serializer.save(
            user=target_user,
            created_by=creator_employee,
            quoted_total_price=quoted_price,
            quoted_deposit=quoted_deposit,
            status=req_status,
        )

        if not is_dashboard and send_admin_notification:
            send_admin_notification(
                title=f"طلب شركات جديد #{business_req.id}",
                message=f"تم استلام طلب شركات جديد من {target_user.business_name} ({total_qty} رأس).",
                category="business_request",
            )

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def quote_price(self, request, pk=None):
        business_req = self.get_object()
        quoted_price = request.data.get("quoted_total_price")
        quoted_deposit = request.data.get("quoted_deposit")
        admin_notes = request.data.get("admin_notes", "")
        expected_delivery_date = request.data.get("expected_delivery_date")

        if not quoted_price:
            return Response(
                {"detail": "يجب إدخال السعر المقترح."}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            q_price_val = Decimal(str(quoted_price))
            q_deposit_val = Decimal(str(quoted_deposit or 0))
            if q_deposit_val > q_price_val:
                return Response(
                    {"detail": "عذراً، لا يمكن أن يكون العربون أكبر من السعر الإجمالي للطلب."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Exception:
            return Response(
                {"detail": "قيم التسعير غير صالحة."}, status=status.HTTP_400_BAD_REQUEST
            )

        business_req.quoted_total_price = quoted_price
        business_req.quoted_deposit = quoted_deposit or Decimal("0")
        business_req.expected_delivery_date = expected_delivery_date
        business_req.status = "quoted"

        if admin_notes and admin_notes.strip():
            time_now = timezone.localtime(timezone.now()).strftime("%Y-%m-%d %I:%M %p")
            appended = f"\n[رسالة الإدارة - {time_now}]: {admin_notes.strip()}"
            business_req.admin_notes = (business_req.admin_notes or "") + appended

        order = Order.objects.create(
            user=business_req.user,
            created_by_employee=request.user,
            status="pending",
            total_price=quoted_price,
            deposit_total=Decimal("0"),
            remaining_amount=quoted_price,
            source="b2b",
            notes=f"طلب شركات #{business_req.id} - {admin_notes}",
        )
        business_req.converted_order = order
        business_req.save()

        if send_notification:
            send_notification(
                business_req.user,
                title=f"تم تسعير طلبك #{business_req.id}",
                message=f"تم تسعير طلبك بقيمة {quoted_price} جنيه. يمكنك مراجعة التفاصيل ودفع العربون أونلاين.",
                category="business_request",
            )

        serializer = self.get_serializer(business_req)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def reject(self, request, pk=None):
        business_req = self.get_object()
        admin_notes = request.data.get("admin_notes", "")

        if admin_notes and admin_notes.strip():
            time_now = timezone.localtime(timezone.now()).strftime("%Y-%m-%d %I:%M %p")
            appended = f"\n[رسالة الإدارة - {time_now}]: {admin_notes.strip()}"
            business_req.admin_notes = (business_req.admin_notes or "") + appended

        business_req.status = "rejected"
        business_req.save()
        if business_req.converted_order:
            order = business_req.converted_order
            order.status = "canceled"
            order.save(update_fields=["status"])
            for item in order.items.all():
                animal = item.animal
                animal.status = "available"
                animal.save(update_fields=['status'])
                from livestock.models import AnimalListing
                AnimalListing.objects.filter(animal=animal, section='full_sale').update(is_active=True, available_shares=1)

        if send_notification:
            send_notification(
                business_req.user,
                title=f"تم رفض طلبك #{business_req.id}",
                message=f"تم رفض طلبك للأسباب التالية: {admin_notes}",
                category="business_request",
            )

        serializer = self.get_serializer(business_req)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def convert_to_order(self, request, pk=None):
        business_req = self.get_object()
        existing_animal_ids = request.data.get("existing_animal_ids", [])
        new_animals_data = request.data.get("new_animals", [])

        if business_req.status not in ["paid", "quoted"]:
            return Response(
                {"detail": "يجب أن يكون الطلب مسعراً أو مدفوعاً قبل التخصيص."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not existing_animal_ids and not new_animals_data:
            return Response(
                {"detail": "يجب تخصيص/إنشاء مواشي لتنفيذ الطلب."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order = business_req.converted_order
        if not order:
            return Response(
                {"detail": "لا يوجد طلب مالي مرتبط."}, status=status.HTTP_400_BAD_REQUEST
            )

        if existing_animal_ids:
            try:
                animal_ids = [int(id) for id in existing_animal_ids]
            except (ValueError, TypeError):
                return Response(
                    {"detail": "معرفات المواشي غير صالحة."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            animals = Animal.objects.filter(id__in=animal_ids, status="available")
            for animal in animals:
                OrderItem.objects.create(
                    order=order, animal=animal, price_per_item=animal.price_egp or Decimal("0")
                )
                animal.status = "sold"
                animal.save()

        if new_animals_data:
            from livestock.models import Category, WeightLog
            from management.models import Supplier
            import datetime

            for data in new_animals_data:
                cat = Category.objects.get(id=data["category_id"])
                supplier = (
                    Supplier.objects.filter(id=data["supplier_id"]).first()
                    if data.get("supplier_id")
                    else None
                )

                animal = Animal.objects.create(
                    category=cat,
                    sex="male",
                    birth_date=datetime.date.today() - datetime.timedelta(days=365),
                    price_egp=data["price"],
                    purchase_price=data["cost"],
                    source_farm=supplier,
                    entry_type="purchased",
                    status="sold",
                )
                WeightLog.objects.create(
                    animal=animal, date=datetime.date.today(), weight_kg=data["weight"]
                )
                OrderItem.objects.create(order=order, animal=animal, price_per_item=data["price"])

        business_req.status = "fulfilled"
        business_req.save()

        order.recalc_totals(commit=True)

        if send_notification:
            send_notification(
                business_req.user,
                title=f"تم تخصيص مواشي طلبك #{business_req.id}",
                message="تم تنفيذ طلبك وإضافة المواشي إليه.",
                category="business_request",
            )

        return Response(
            {
                "detail": "تم التخصيص والتحويل بنجاح",
                "order_id": order.id,
                "order_details": OrderSerializer(order).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="update-delivery",
        permission_classes=[IsAuthenticated],
    )
    @transaction.atomic
    def update_delivery(self, request, pk=None):
        business_req = self.get_object()
        is_staff = request.user.is_staff or getattr(request.user, "employee_profile", None) is not None

        if business_req.user != request.user and not is_staff:
            return Response(
                {"detail": "غير مصرح لك بتعديل هذا الطلب."}, status=status.HTTP_403_FORBIDDEN
            )

        order = business_req.converted_order
        if not order:
            return Response(
                {"detail": "لا يوجد طلب مالي مرتبط بهذا العقد بعد."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not is_staff:
            if order.delivery_type or order.delivery_date or order.delivery_address:
                return Response(
                    {
                        "detail": "عذراً، لقد قمت بتحديد بيانات الاستلام مسبقاً. لتعديلها يرجى التواصل مع الإدارة."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        delivery_type = request.data.get("delivery_type")
        delivery_date = request.data.get("delivery_date")
        delivery_address_id = request.data.get("delivery_address_id")
        notes = request.data.get("notes")
        new_address_data = request.data.get("newAddress")
        new_admin_notes = request.data.get("admin_notes")

        system_changes = []

        if delivery_type and order.delivery_type != delivery_type:
            dt_str = "توصيل للعنوان"
            if delivery_type == "delivery":
                if delivery_address_id == "new_address" and new_address_data:
                    dt_str = f"توصيل إلى ({new_address_data.get('governorate', '')})"
                elif delivery_address_id and str(delivery_address_id) not in ["new_address", ""]:
                    try:
                        addr = Address.objects.get(id=delivery_address_id, user=business_req.user)
                        dt_str = f"توصيل إلى ({addr.governorate})"
                    except Address.DoesNotExist:
                        pass
            else:
                dt_str = "استلام من المزرعة"

            system_changes.append(f"طريقة الاستلام إلى ({dt_str})")
            order.delivery_type = delivery_type

        if delivery_date and str(order.delivery_date) != str(delivery_date):
            system_changes.append(f"الموعد إلى ({delivery_date})")
            order.delivery_date = delivery_date
        elif not delivery_date and order.delivery_date is not None:
            system_changes.append("إلغاء موعد التوصيل")
            order.delivery_date = None

        if notes is not None and order.notes != notes:
            order.notes = notes

        if delivery_type == "pickup":
            if order.delivery_address is not None:
                system_changes.append("إلغاء عنوان التوصيل")
            order.delivery_address = None
        else:
            if delivery_address_id == "new_address" and new_address_data:
                addr = Address.objects.create(
                    user=business_req.user,
                    governorate=new_address_data.get("governorate", ""),
                    city=new_address_data.get("city", ""),
                    street=new_address_data.get("street", ""),
                    is_default=False,
                )
                order.delivery_address = addr
                system_changes.append("إضافة عنوان توصيل جديد")
            elif delivery_address_id and str(delivery_address_id) not in ["new_address", ""]:
                try:
                    addr = Address.objects.get(id=delivery_address_id, user=business_req.user)
                    if order.delivery_address != addr:
                        order.delivery_address = addr
                        system_changes.append("تغيير عنوان التوصيل")
                except Address.DoesNotExist:
                    return Response(
                        {"detail": "العنوان غير موجود أو لا يخص المستخدم."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        order.save()

        if is_staff:
            time_now = timezone.localtime(timezone.now()).strftime("%Y-%m-%d %I:%M %p")
            log_text = ""

            if system_changes:
                log_text += f"\n[نظام - {time_now}]: تم تحديث {', '.join(system_changes)}."

            if new_admin_notes and new_admin_notes.strip():
                log_text += f"\n[رسالة الإدارة - {time_now}]: {new_admin_notes.strip()}"

            if log_text:
                business_req.admin_notes = (business_req.admin_notes or "") + log_text
                business_req.save(update_fields=["admin_notes"])

                if send_notification:
                    send_notification(
                        business_req.user,
                        title=f"تحديث في طلب الشركات #{business_req.id}",
                        message="تم تحديث إعدادات التوصيل أو إضافة رسالة من الإدارة. يرجى مراجعة الطلب.",
                        category="business_request",
                    )

        return Response({"detail": "تم تحديث بيانات الاستلام والتوصيل للشركة بنجاح."})

    @action(detail=False, methods=["get"])
    def statistics(self, request):
        if not (request.user.is_staff or getattr(request.user, "employee_profile", None) is not None):
            return Response({"detail": "غير مصرح لك."}, status=status.HTTP_403_FORBIDDEN)

        total_requests = BusinessRequest.objects.count()
        pending_requests = BusinessRequest.objects.filter(status="pending").count()
        quoted_requests = BusinessRequest.objects.filter(status="quoted").count()
        paid_requests = BusinessRequest.objects.filter(status="paid").count()
        fulfilled_requests = BusinessRequest.objects.filter(status="fulfilled").count()
        rejected_requests = BusinessRequest.objects.filter(status="rejected").count()

        from django.db.models import Count
        from django.utils import timezone
        from datetime import timedelta

        last_month = timezone.now() - timedelta(days=30)
        monthly_stats = (
            BusinessRequest.objects.filter(created_at__gte=last_month)
            .values("status")
            .annotate(count=Count("id"))
        )

        return Response(
            {
                "total": total_requests,
                "pending": pending_requests,
                "quoted": quoted_requests,
                "paid": paid_requests,
                "fulfilled": fulfilled_requests,
                "rejected": rejected_requests,
                "monthly_stats": monthly_stats,
            }
        )

def print_employee_contract(request):
    emp_id = request.GET.get("emp_id")
    employee = get_object_or_404(Employee, id=emp_id) if emp_id else None
    return render(
        request, "contracts/employee_contract.html", {"employee": employee, "date": date.today()}
    )

def print_farm_contract(request):
    farm_id = request.GET.get("farm_id")
    farm = get_object_or_404(Supplier, id=farm_id) if farm_id else None
    return render(request, "contracts/farm_contract.html", {"farm": farm, "date": date.today()})

def print_b2b_contract(request):
    user_id = request.GET.get("user_id")
    b2b_customer = get_object_or_404(CustomerUser, id=user_id) if user_id else None
    return render(
        request, "contracts/b2b_contract.html", {"b2b": b2b_customer, "date": date.today()}
    )

def print_supplier_receipt(request):
    context = {
        "name": request.GET.get("name", ""),
        "amount": request.GET.get("amount", ""),
        "national_id": request.GET.get("national_id", ""),
        "date": request.GET.get("date", ""),
        "notes": request.GET.get("notes", ""),
    }
    return render(request, "contracts/supplier_receipt.html", context)
