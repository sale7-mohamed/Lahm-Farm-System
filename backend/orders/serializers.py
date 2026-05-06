from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from .models import Order, OrderItem, SpecialRequest, Shipment, Vehicle, BusinessRequest
from livestock.serializers import AnimalSerializer, CategorySerializer
from accounts.serializers import DashboardCustomerSerializer
from accounts.models import User as CustomerUser

User = get_user_model()

class OrderItemSerializer(serializers.ModelSerializer):
    animal = AnimalSerializer(read_only=True)
    extra_parts_preference_display = serializers.CharField(
        source='get_extra_parts_preference_display',
        read_only=True
    )
    animal_category = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields =[
            'id', 'animal', 'price_per_item', 'share_quantity',
            'extra_parts_preference', 'extra_parts_preference_display',
            'selected_services', 'service_cost', 'listing_section',
            'actual_weight', 'original_price', 'original_weight',
            'animal_category', 'request_slaughter_video', 'slaughter_video'
        ]

    def get_animal_category(self, obj):
        from django.utils.translation import get_language
        if obj.animal and obj.animal.category:
            return obj.animal.category.name_en if (get_language() == 'en' and obj.animal.category.name_en) else obj.animal.category.name_ar
        return ''

class OrderSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    delivery_address_text = serializers.SerializerMethodField()
    order_type_label = serializers.SerializerMethodField()
    min_deposit_required = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_items_services = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    business_request_id = serializers.SerializerMethodField()

    payments = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields =[
            'id', 'user', 'status', 'status_display', 'created_at',
            'updated_at', 'total_price', 'deposit_total', 'remaining_amount',
            'min_deposit_required', 'service_cost', 'total_items_services',
            'delivery_fee', 'applied_discount_amount',
            'delivery_type', 'delivery_date', 'has_slaughter_service',
            'notes', 'delivery_address_text', 'order_type_label', 'items',
            'source', 'business_request_id', 'pricing_model', 'payments'
        ]
        read_only_fields = fields

    def get_payments(self, obj):
        return obj.payments.all().values('id', 'amount', 'created_at', 'status', 'payment_method', 'transaction_id')

    def get_business_request_id(self, obj):
        if obj.source == 'b2b' and hasattr(obj, 'business_source'):
            return obj.business_source.id
        return None

    def get_delivery_address_text(self, obj):
        if obj.delivery_address:
            return f"{obj.delivery_address.city}, {obj.delivery_address.street}"
        return None

    def get_order_type_label(self, obj):
        if obj.source == 'b2b':
            return 'توريد شركات'
        if obj.source == 'on_farm':
            return 'نقطة بيع'

        for item in obj.items.all():
            services = item.selected_services or {}
            context = services.get('_order_context', '')

            if context == 'adahi_group':
                return 'مجموعة خاصة'
            if context == 'adahi_pool':
                return 'مسبح أضاحي'
            if context == 'shares':
                return 'مشاركة (لحم)'
            if context == 'adahi':
                return 'أضحية كاملة'

        return 'طلب متجر'

class ManagementOrderSerializer(serializers.ModelSerializer):
    user = DashboardCustomerSerializer(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    order_type_label = serializers.SerializerMethodField()
    min_deposit_required = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_items_services = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    payments = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields =[
            'id', 'user', 'status', 'status_display', 'order_type_label',
            'source', 'payment_method', 'total_price', 'deposit_total',
            'remaining_amount', 'min_deposit_required', 'service_cost',
            'total_items_services', 'delivery_fee', 'applied_discount_amount',
            'delivery_date', 'delivery_address',
            'has_slaughter_service', 'notes',
            'created_at', 'updated_at', 'items',
            'arrival_sms_sent_at', 'otp_sent_count', 'signed_receipt_image', 'delivery_photo'
        ]
        read_only_fields = fields

    def get_order_type_label(self, obj):
        if obj.source == 'on_farm':
            return 'نقطة بيع'

        for item in obj.items.all():
            services = item.selected_services or {}
            context = services.get('_order_context', '')

            if context == 'adahi_group':
                return 'مجموعة خاصة'
            if context == 'adahi_pool':
                return 'مسبح أضاحي'
            if context == 'shares':
                return 'مشاركة (لحم)'
            if context == 'adahi':
                return 'أضحية كاملة'

        return 'طلب متجر'

class CustomerSpecialRequestSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    sourced_animal_details = AnimalSerializer(
        source='sourced_animal',
        read_only=True
    )

    class Meta:
        model = SpecialRequest
        fields = [
            'id', 'requested_specs', 'status', 'status_display',
            'notes', 'created_at', 'sourced_animal_details'
        ]

class SpecialRequestSerializer(serializers.ModelSerializer):
    user_details = DashboardCustomerSerializer(
        source='user',
        read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    user = serializers.PrimaryKeyRelatedField(
        queryset=CustomerUser.objects.all(),
        write_only=True
    )
    sourced_animal_details = AnimalSerializer(source='sourced_animal', read_only=True)

    class Meta:
        model = SpecialRequest
        fields = [
            'id', 'user', 'user_details', 'requested_specs', 'status',
            'status_display', 'notes', 'sourced_animal', 'related_order',
            'created_at', 'sourced_animal_details'
        ]

class ShipmentSerializer(serializers.ModelSerializer):
    supervisor_name = serializers.CharField(
        source='supervisor.full_name',
        read_only=True
    )
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    orders_count = serializers.IntegerField(
        source='orders.count',
        read_only=True
    )
    orders_details = serializers.SerializerMethodField()
    vehicle_name = serializers.CharField(
        source='vehicle.name',
        read_only=True
    )
    vehicle_plate = serializers.CharField(
        source='vehicle.plate_number',
        read_only=True
    )

    class Meta:
        model = Shipment
        fields = [
            'id', 'supervisor', 'supervisor_name', 'vehicle', 'vehicle_name',
            'vehicle_plate', 'driver_name', 'driver_phone', 'butcher_names',
            'status', 'status_display', 'date', 'notes', 'created_at',
            'orders_count', 'orders_details', 'last_lat', 'last_lng',
            'last_location_update', 'history_log'
        ]

    def get_orders_details(self, obj):
        orders = obj.orders.select_related('user', 'delivery_address').prefetch_related(
            'items__animal__category', 'items__animal__source_farm'
        ).all()
        return [
            {
                'id': o.id,
                'customer_name': o.user.full_name,
                'customer_phone': o.user.phone,
                'address': (
                    f"{o.delivery_address.governorate}, "
                    f"{o.delivery_address.city}, "
                    f"{o.delivery_address.street}"
                    if o.delivery_address
                    else "استلام من المزرعة"
                ),
                'governorate': (
                    o.delivery_address.governorate
                    if o.delivery_address
                    else "مقر المزرعة"
                ),
                'remaining_amount': o.remaining_amount,
                'has_slaughter': o.has_slaughter_service,
                'status': o.status,
                'notes': o.notes,
                'items': [
                    {
                        'code': i.animal.code,
                        'category': i.animal.category.name_ar if i.animal.category else 'غير محدد',
                        'services': i.selected_services,
                        'supplier_name': i.animal.source_farm.name if i.animal.source_farm else 'مزارعنا',
                        'extra_parts': i.get_extra_parts_preference_display()
                    } for i in o.items.all()
                ]
            }
            for o in orders
        ]

class BusinessRequestSerializer(serializers.ModelSerializer):
    user_business_name = serializers.CharField(source='user.business_name', read_only=True)
    user_phone = serializers.CharField(source='user.phone', read_only=True)
    user_full_name = serializers.CharField(source='user.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    categories_details = serializers.SerializerMethodField()
    business_settings = serializers.SerializerMethodField()
    total_quantity = serializers.IntegerField(read_only=True)
    converted_order_details = serializers.SerializerMethodField()

    class Meta:
        model = BusinessRequest
        fields = [
            'id', 'user', 'user_business_name', 'user_full_name', 'user_phone',
            'request_details', 'customer_notes', 'admin_notes', 'quoted_total_price',
            'quoted_deposit', 'expected_delivery_date', 'status',
            'status_display', 'converted_order', 'converted_order_details', 'created_by',
            'created_by_name', 'created_at', 'updated_at',
            'categories_details', 'business_settings', 'total_quantity'
        ]
        read_only_fields = ('user', 'converted_order', 'created_at', 'updated_at', 'created_by')

    def get_converted_order_details(self, obj):
        if not obj.converted_order:
            return None
        order = obj.converted_order
        payments = order.payments.all().values('id', 'amount', 'created_at', 'status', 'payment_method')

        addr_info = None
        if order.delivery_address:
            addr_info = {
                "id": order.delivery_address.id,
                "governorate": order.delivery_address.governorate,
                "city": order.delivery_address.city,
                "street": order.delivery_address.street
            }

        items_data = []
        for item in order.items.all():
            items_data.append({
                'id': item.id,
                'animal_code': item.animal.code,
                'category_name': item.animal.category.name_ar if item.animal.category else '',
                'price': item.price_per_item,
                'weight': item.actual_weight or item.original_weight or item.animal.current_weight
            })

        return {
            'id': order.id,
            'total_price': order.total_price,
            'deposit_total': order.deposit_total,
            'remaining_amount': order.remaining_amount,
            'status': order.status,
            'status_display': order.get_status_display(),
            'delivery_type': order.delivery_type,
            'delivery_date': order.delivery_date,
            'delivery_address': addr_info,
            'notes': order.notes,
            'payments': list(payments),
            'items': items_data
        }

    def get_categories_details(self, obj):
        from livestock.models import Category
        if not isinstance(obj.request_details, list):
            return []
        category_ids = []
        for item in obj.request_details:
            if isinstance(item, dict) and 'category_id' in item:
                try:
                    category_ids.append(int(item['category_id']))
                except (ValueError, TypeError):
                    continue
        if not category_ids:
            return []
        categories = Category.objects.filter(id__in=category_ids)
        return CategorySerializer(categories, many=True).data

    def get_business_settings(self, obj):
        from core.models import OperationSettings
        settings = OperationSettings.load()
        return {
            'min_business_order_quantity': settings.min_business_order_quantity,
            'business_weight_margin': float(settings.business_weight_margin),
            'is_active': settings.is_adahi_season_active
        }

    def validate_request_details(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(_("تفاصيل الطلب يجب أن تكون قائمة"))
        if not value:
            raise serializers.ValidationError(_("تفاصيل الطلب لا يمكن أن تكون فارغة"))

        for index, item in enumerate(value):
            if not isinstance(item, dict):
                raise serializers.ValidationError(_("كل عنصر في تفاصيل الطلب يجب أن يكون قاموساً"))

            required_fields = ['category_id', 'weight_range', 'quantity']
            for field in required_fields:
                if field not in item:
                    raise serializers.ValidationError(_(f"الحقل '{field}' مطلوب في كل عنصر"))

            try:
                quantity = int(item['quantity'])
                if quantity <= 0:
                    raise ValueError
            except (ValueError, TypeError):
                raise serializers.ValidationError(_("الكمية يجب أن تكون رقماً صحيحاً موجباً"))

        return value

    def create(self, validated_data):
        user = validated_data.get('user')
        if not user.is_corporate:
            raise serializers.ValidationError({'user': _("يجب أن يكون العميل حساب شركة/أعمال لإنشاء طلب شركات")})

        from core.models import OperationSettings
        settings = OperationSettings.load()
        request_details = validated_data.get('request_details', [])
        total_quantity = 0
        for item in request_details:
            if isinstance(item, dict):
                try:
                    total_quantity += int(item.get('quantity', 0))
                except (ValueError, TypeError):
                    pass

        if total_quantity < settings.min_business_order_quantity:
            raise serializers.ValidationError({'request_details': _(f"الحد الأدنى لطلبات الشركات هو {settings.min_business_order_quantity} رأس.")})

        return super().create(validated_data)

class VehicleSerializer(serializers.ModelSerializer):

    class Meta:
        model = Vehicle
        fields = '__all__'

