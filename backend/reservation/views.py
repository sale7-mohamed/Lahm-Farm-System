from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.conf import settings
from decimal import Decimal
from datetime import date, timedelta
from django.db import transaction

from .models import Reservation
from .serializers import ReservationSerializer
from livestock.models import Animal, DeliveryArea, ClientServiceOption, ServicePriceSetting, DeliverySetting
from cart.views import GuestCartAPIView

try:
    from notifications.models import Notification
    from notifications.utils import send_notification, send_admin_notification
except ImportError:
    Notification = None
    send_notification = None
    send_admin_notification = None

class InitialBookingRequestAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        animal_id = request.data.get('animal')
        payment_type = request.data.get('payment_type')
        try:
            user_entered_deposit_amount = Decimal(str(request.data.get('user_entered_deposit_amount', 0)))
        except (ValueError, TypeError):
            user_entered_deposit_amount = Decimal(0)

        delivery_option_type = request.data.get('delivery_option_type')
        slaughter_option_type = request.data.get('slaughter_option_type')
        cutting_option = request.data.get('cutting_option')
        packaging_option = request.data.get('packaging_option')
        butcher_notes = request.data.get('butcher_notes')
        delivery_area_id = request.data.get('delivery_area')
        client_service_options_ids = request.data.get('client_services', [])
        requested_delivery_date_str = request.data.get('requested_delivery_date')

        try:
            animal = Animal.objects.get(id=animal_id, status='available')
        except Animal.DoesNotExist:
            return Response({"detail": "الحيوان غير موجود أو غير متاح للحجز."}, status=status.HTTP_404_NOT_FOUND)

        if Reservation.objects.filter(animal=animal, status__in=['pending', 'confirmed']).exists():
            return Response({"detail": "هذا الحيوان محجوز بالفعل أو في انتظار الدفع."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            requested_delivery_date_obj = date.fromisoformat(requested_delivery_date_str)
        except (ValueError, TypeError):
            return Response({"detail": "تاريخ التسليم/الاستلام غير صحيح."}, status=status.HTTP_400_BAD_REQUEST)

        delivery_setting = DeliverySetting.objects.first()
        if not delivery_setting:
            return Response({"detail": "Delivery settings are not configured. Please contact support."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        MIN_DEPOSIT_PERCENTAGE = delivery_setting.min_deposit_percentage
        standard_free_booking_days = delivery_setting.standard_free_booking_days
        preparation_days = delivery_setting.preparation_days

        slaughter_price = getattr(ServicePriceSetting.objects.filter(name="ذبح", is_active=True).first(), 'price', Decimal(0))
        cutting_price = getattr(ServicePriceSetting.objects.filter(name="تقطيع", is_active=True).first(), 'price', Decimal(0))
        packaging_price = getattr(ServicePriceSetting.objects.filter(name="تعبئة", is_active=True).first(), 'price', Decimal(0))
        extended_duration_per_day_price = getattr(ServicePriceSetting.objects.filter(name="رسوم مدة حجز إضافية", is_active=True).first(), 'price', Decimal(0))

        client_service_prices = []
        if client_service_options_ids:
            client_options_qs = ClientServiceOption.objects.filter(
                id__in=client_service_options_ids, is_active=True
            ).values_list('price', flat=True)
            client_service_prices = list(client_options_qs)

        temp_reservation = Reservation(
            animal=animal,
            user=request.user if request.user.is_authenticated else None,
            booking_type=payment_type,
            paid_amount_on_booking=user_entered_deposit_amount,
            delivery_option_type=delivery_option_type,
            slaughter_option_type=slaughter_option_type,
            cutting_option=cutting_option,
            packaging_option=packaging_option,
            butcher_notes=butcher_notes,
            delivery_area=DeliveryArea.objects.filter(id=delivery_area_id).first() if delivery_area_id else None,
            client_services_options_ids=client_service_options_ids,
            requested_delivery_date=requested_delivery_date_obj,
        )

        temp_reservation.booking_start_date = requested_delivery_date_obj - timedelta(days=preparation_days)
        if temp_reservation.booking_start_date < date.today():
            temp_reservation.booking_start_date = date.today()

        temp_reservation.calculate_prices(
            min_deposit_percentage=MIN_DEPOSIT_PERCENTAGE,
            standard_free_booking_days=standard_free_booking_days,
            slaughter_price=slaughter_price,
            cutting_price=cutting_price,
            packaging_price=packaging_price,
            extended_duration_per_day_price=extended_duration_per_day_price,
            client_service_options_prices=client_service_prices
        )

        min_deposit_required = temp_reservation.total_calculated_price * MIN_DEPOSIT_PERCENTAGE

        if payment_type == 'deposit':
            if user_entered_deposit_amount < min_deposit_required:
                return Response(
                    {"detail": f"المبلغ المدفوع كعربون أقل من الحد الأدنى. الحد الأدنى المطلوب هو {min_deposit_required:.2f} جنيه.",
                     "min_deposit_required": f"{min_deposit_required:.2f}"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
        elif payment_type == 'full':
            temp_reservation.paid_amount_on_booking = temp_reservation.total_calculated_price
            temp_reservation.remaining_amount_due = Decimal(0)

        if request.user.is_authenticated:
            with transaction.atomic():
                reservation = Reservation.objects.create(
                    animal=animal,
                    user=request.user,
                    status='pending',
                    booking_type=payment_type,
                    paid_amount_on_booking=temp_reservation.paid_amount_on_booking,
                    total_calculated_price=temp_reservation.total_calculated_price,
                    remaining_amount_due=temp_reservation.remaining_amount_due,
                    delivery_option_type=delivery_option_type,
                    slaughter_option_type=slaughter_option_type,
                    cutting_option=cutting_option,
                    packaging_option=packaging_option,
                    butcher_notes=butcher_notes,
                    delivery_area=DeliveryArea.objects.filter(id=delivery_area_id).first() if delivery_area_id else None,
                    client_services_options_ids=client_service_options_ids,
                    requested_delivery_date=requested_delivery_date_obj,
                    booking_start_date=temp_reservation.booking_start_date,
                    extended_duration_cost=Decimal(str(temp_reservation.extended_duration_cost)),
                )
                animal.status = 'reserved'
                animal.save()

            if send_notification:
                send_notification(
                    request.user,
                    title="تم بدء حجز جديد",
                    message=f"لقد قمت ببدء حجز الحيوان {animal.code}. السعر الإجمالي: {reservation.total_calculated_price:.2f} جنيه."
                )
            if send_admin_notification:
                send_admin_notification(
                    title="حجز جديد",
                    message=f"تم إنشاء حجز جديد على الحيوان {animal.code} بواسطة {request.user.username}. المبلغ المدفوع: {reservation.paid_amount_on_booking:.2f} جنيه."
                )

            serializer = ReservationSerializer(reservation, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        else:
            request.session[GuestCartAPIView.SESSION_PENDING_BOOKING_KEY] = {
                'animal_id': animal_id,
                'payment_type': payment_type,
                'user_entered_deposit_amount': float(user_entered_deposit_amount),
                'total_calculated_price': float(temp_reservation.total_calculated_price),
                'paid_amount_on_booking': float(temp_reservation.paid_amount_on_booking),
                'remaining_amount_due': float(temp_reservation.remaining_amount_due),
                'delivery_option_type': delivery_option_type,
                'slaughter_option_type': slaughter_option_type,
                'cutting_option': cutting_option,
                'packaging_option': packaging_option,
                'butcher_notes': butcher_notes,
                'delivery_area_id': delivery_area_id,
                'client_services_options_ids': client_service_options_ids,
                'requested_delivery_date': requested_delivery_date_obj.isoformat(),
                'booking_start_date': temp_reservation.booking_start_date.isoformat() if temp_reservation.booking_start_date else None,
                'extended_duration_cost': float(temp_reservation.extended_duration_cost),
            }
            request.session.modified = True

            return Response(
                {
                    "detail": "يرجى تسجيل الدخول أو إنشاء حساب لإتمام الحجز.",
                    "login_required": True,
                    "booking_summary": {
                        "total_calculated_price": f"{temp_reservation.total_calculated_price:.2f}",
                        "min_deposit_required": f"{min_deposit_required:.2f}",
                        "your_deposit": f"{user_entered_deposit_amount:.2f}",
                        "remaining_due": f"{temp_reservation.remaining_amount_due:.2f}",
                        "animal_name": animal.name,
                        "animal_code": animal.code,
                    }
                },
                status=status.HTTP_200_OK
            )

class ReservationViewSet(viewsets.ModelViewSet):
    serializer_class = ReservationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        is_dashboard = False
        if self.request.auth and hasattr(self.request.auth, 'get'):
            is_dashboard = (self.request.auth.get('user_type') == 'employee')

        if is_dashboard and (user.is_staff or user.is_superuser):
            return Reservation.objects.all().select_related('animal', 'user', 'delivery_area')

        return Reservation.objects.filter(user=user).select_related('animal', 'user', 'delivery_area')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        reservation = serializer.save(user=self.request.user)
        animal = reservation.animal
        if animal.status == 'available':
            animal.status = 'reserved'
            animal.save()

        if Notification:
            Notification.objects.create(
                user=self.request.user,
                title="تم إنشاء حجز جديد",
                message=f"لقد قمت بحجز الحيوان {getattr(reservation.animal, 'code', '')}."
            )
        if send_admin_notification:
            send_admin_notification(
                title="حجز جديد",
                message=f"تم إنشاء حجز جديد على الحيوان {animal.code} بواسطة {self.request.user.username}. المبلغ المدفوع: {reservation.paid_amount_on_booking:.2f} جنيه."
            )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not (request.user.is_staff or request.user.is_superuser):
            if set(request.data.keys()) - {'status'}:
                return Response({"detail": "غير مصرح لك بتعديل هذا الحجز بهذه الطريقة."}, status=status.HTTP_403_FORBIDDEN)

        old_status = instance.status
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if Notification and instance.status != old_status:
            Notification.objects.create(
                user=instance.user,
                title="تم تحديث حالة الحجز",
                message=f"الحجز على {instance.animal.code} أصبح {instance.status}."
            )
        return Response(serializer.data)

    def perform_update(self, serializer):
        serializer.save()
        if serializer.instance.status in ['cancelled', 'completed']:
            animal = serializer.instance.animal
            if animal.status == 'reserved':
                animal.status = 'available' if serializer.instance.status == 'cancelled' else 'sold'
                animal.save()

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='cancel')
    def cancel(self, request, pk=None):
        reservation = self.get_object()
        if reservation.status == 'cancelled':
            return Response({"detail": "الحجز ملغي بالفعل."}, status=status.HTTP_400_BAD_REQUEST)

        if not (request.user.is_staff or request.user.is_superuser or reservation.user == request.user):
            return Response({"detail": "غير مصرح لك بإلغاء هذا الحجز."}, status=status.HTTP_403_FORBIDDEN)

        reservation.status = 'cancelled'
        reservation.save(update_fields=['status'])

        if Notification:
            Notification.objects.create(
                user=reservation.user,
                title="تم إلغاء الحجز",
                message=f"تم إلغاء الحجز على الحيوان {reservation.animal.code}."
            )

        return Response(
            {"detail": f"تم إلغاء الحجز على {reservation.animal.code}."},
            status=status.HTTP_200_OK
        )

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {"detail": "استخدم /cancel/ لإلغاء الحجز بدلاً من الحذف."},
                status=status.HTTP_405_METHOD_NOT_ALLOWED
            )

        instance = self.get_object()
        animal_code = getattr(instance.animal, "code", "")
        self.perform_destroy(instance)
        if Notification:
            Notification.objects.create(
                user=instance.user,
                title="تم حذف الحجز",
                message=f"تم حذف الحجز على الحيوان {animal_code}."
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='my')
    def my_reservations(self, request):
        qs = self.get_queryset()
        ser = self.get_serializer(qs, many=True, context={'request': request})
        return Response(ser.data, status=status.HTTP_200_OK)
