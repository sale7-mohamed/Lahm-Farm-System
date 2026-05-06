# D:\pro\life\reservation\serializers.py

from rest_framework import serializers
from .models import Reservation
from livestock.models import Animal, DeliveryArea, ClientServiceOption, ServicePriceSetting, DeliverySetting
from django.conf import settings
from decimal import Decimal
from datetime import date, timedelta

class ReservationSerializer(serializers.ModelSerializer):
    animal_code = serializers.ReadOnlyField(source='animal.code')
    user_name = serializers.ReadOnlyField(source='user.username')

    payment_type = serializers.CharField(write_only=True, required=True)
    user_entered_deposit_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, default=0, write_only=True
    )
    delivery_option_type = serializers.CharField(required=True, write_only=True)
    slaughter_option_type = serializers.CharField(required=False, allow_null=True, write_only=True)
    cutting_option = serializers.CharField(required=False, allow_null=True, write_only=True)
    packaging_option = serializers.CharField(required=False, allow_null=True, write_only=True)
    butcher_notes = serializers.CharField(required=False, allow_null=True, write_only=True)
    delivery_area_id = serializers.PrimaryKeyRelatedField(
        queryset=DeliveryArea.objects.filter(is_active=True), source='delivery_area', required=False, allow_null=True, write_only=True
    )
    client_service_options_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True, write_only=True
    )
    requested_delivery_date = serializers.DateField(required=True, write_only=True)

    class Meta:
        model = Reservation
        fields = [
            'id',
            'animal',
            'animal_code',
            'user',
            'user_name',
            'status',
            'reserved_at',
            'expires_at',
            'booking_type',
            'paid_amount_on_booking',
            'total_calculated_price',
            'remaining_amount_due',
            'extended_duration_cost',

            'payment_type',
            'user_entered_deposit_amount',
            'delivery_option_type',
            'slaughter_option_type',
            'cutting_option',
            'packaging_option',
            'butcher_notes',
            'delivery_area_id',
            'client_service_options_ids',
            'requested_delivery_date',
        ]
        read_only_fields = ['user', 'status', 'reserved_at', 'expires_at',
                            'booking_type', 'paid_amount_on_booking', 'total_calculated_price',
                            'remaining_amount_due', 'extended_duration_cost',
                            ]

    def validate(self, data):
        animal = data.get('animal')
        requested_delivery_date = data.get('requested_delivery_date')
        delivery_option_type = data.get('delivery_option_type')
        slaughter_option_type = data.get('slaughter_option_type')
        delivery_area = data.get('delivery_area')

        if not animal or animal.status != 'available':
            raise serializers.ValidationError("الحيوان غير متاح للحجز.")

        if Reservation.objects.filter(
            animal=animal,
            status__in=['pending', 'confirmed']
        ).exists():
            raise serializers.ValidationError("هذا الحيوان محجوز بالفعل أو في انتظار الدفع.")

        if not requested_delivery_date:
            raise serializers.ValidationError({"requested_delivery_date": "تاريخ التسليم/الاستلام مطلوب."})

        if delivery_option_type == 'to_home' and not delivery_area:
            raise serializers.ValidationError({"delivery_area_id": "المحافظة مطلوبة عند اختيار التوصيل للمنزل."})

        if slaughter_option_type == 'live':
            if data.get('cutting_option') == 'yes' or data.get('packaging_option') == 'yes':
                raise serializers.ValidationError("لا يمكن اختيار التقطيع أو التعبئة لحيوان حي.")

        if delivery_option_type == 'to_home' and slaughter_option_type != 'slaughtered':
            raise serializers.ValidationError({"slaughter_option_type": "يجب أن يكون الحيوان مذبوحاً للتوصيل للمنزل."})

        return data

    def create(self, validated_data):
        delivery_setting = DeliverySetting.objects.first()
        if not delivery_setting:
            raise serializers.ValidationError("Delivery settings are not configured. Please contact support.")

        animal = validated_data.get('animal')
        MIN_DEPOSIT_PERCENTAGE = delivery_setting.min_deposit_percentage
        free_care_days = delivery_setting.free_care_days
        preparation_days = delivery_setting.preparation_days

        slaughter_price = getattr(ServicePriceSetting.objects.filter(name="ذبح", is_active=True).first(), 'price', Decimal(0))
        cutting_price = getattr(ServicePriceSetting.objects.filter(name="تقطيع", is_active=True).first(), 'price', Decimal(0))
        packaging_price = getattr(ServicePriceSetting.objects.filter(name="تعبئة", is_active=True).first(), 'price', Decimal(0))

        extended_duration_per_day_price = animal.category.daily_care_fee if animal and animal.category else Decimal('0.00')

        payment_type = validated_data.pop('payment_type')
        user_entered_deposit_amount = validated_data.pop('user_entered_deposit_amount')

        client_service_options_ids = validated_data.pop('client_service_options_ids', [])
        client_service_prices = []
        if client_service_options_ids:
            client_options_qs = ClientServiceOption.objects.filter(
                id__in=client_service_options_ids, is_active=True
            ).values_list('price', flat=True)
            client_service_prices = list(client_options_qs)

        validated_data['booking_type'] = payment_type
        if payment_type == 'deposit':
            validated_data['paid_amount_on_booking'] = user_entered_deposit_amount
        else:
            validated_data['paid_amount_on_booking'] = Decimal(0)

        requested_delivery_date = validated_data.get('requested_delivery_date')
        if requested_delivery_date:
            validated_data['booking_start_date'] = requested_delivery_date - timedelta(days=preparation_days)
            if validated_data['booking_start_date'] < date.today():
                validated_data['booking_start_date'] = date.today()

        reservation = Reservation(**validated_data)

        reservation.calculate_prices(
            min_deposit_percentage=MIN_DEPOSIT_PERCENTAGE,
            standard_free_booking_days=free_care_days,
            slaughter_price=slaughter_price,
            cutting_price=cutting_price,
            packaging_price=packaging_price,
            extended_duration_per_day_price=extended_duration_per_day_price,
            client_service_options_prices=client_service_prices
        )

        if payment_type == 'deposit':
            min_deposit_required = reservation.total_calculated_price * MIN_DEPOSIT_PERCENTAGE
            if user_entered_deposit_amount < min_deposit_required:
                raise serializers.ValidationError(
                    {"user_entered_deposit_amount": f"المبلغ المدفوع كعربون أقل من الحد الأدنى. الحد الأدنى المطلوب هو {min_deposit_required:.2f} جنيه."}
                )
        elif payment_type == 'full':
            reservation.paid_amount_on_booking = reservation.total_calculated_price
            reservation.remaining_amount_due = Decimal(0)

        if 'user' not in validated_data:
            reservation.user = self.context['request'].user

        reservation.save()

        return reservation

    def update(self, instance, validated_data):
        if 'status' in validated_data:
            instance.status = validated_data.get('status', instance.status)
            instance.save()
            return instance

        raise serializers.ValidationError("تحديث الحجز من خلال هذا المسار غير مدعوم حاليًا إلا لتغيير الحالة.")
