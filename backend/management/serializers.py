from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.models import Permission
from django.db import transaction
from django.utils.translation import gettext_lazy as _
from django.db.models import Q, Sum, F, DecimalField
from django.utils import timezone
from django.utils.timesince import timesince

from .backends import EmployeeBackend
from .models import (
    Employee, FarmDepartment, EmployeeRole, HealthLog, FeedingLog,
    Payroll, PayrollEntry, InventoryItem, PurchaseOrder, PurchaseOrderItem, ApprovalRequest,
    WeightLog, Supplier, EmployeeStatusLog,
    ChatRoom, ChatMessage, RolePermission, PasswordChangeLog,
    SalaryChangeLog, DiscountLog, AttendanceLog, StockMovement,
    JobOpening, JobApplication, ContactMessage, CustomerCallLog,
    DocumentArchive, CustomerNoteLog, CustomerSuspensionLog
)
from core.models import GlobalDiscountSettings, OperationSettings
from livestock.models import Animal, AnimalImage, DeliverySetting, DeliveryArea
from orders.models import Order, OrderItem, SpecialRequest
from accounts.models import User as CustomerUser
from accounts.serializers import AddressSerializer as BaseAddressSerializer
from life.serializers import CustomTokenObtainPairSerializer as BaseTokenSerializer
from livestock.serializers import DeliverySettingSerializer
from orders.serializers import SpecialRequestSerializer
from .permissions_engine import get_all_user_access
from decimal import Decimal

class GlobalDiscountSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlobalDiscountSettings
        fields = '__all__'

class DiscountLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.full_name', read_only=True)
    target_name = serializers.SerializerMethodField()

    class Meta:
        model = DiscountLog
        fields = ['id', 'target_type', 'target_name', 'changed_by_name', 'department_snapshot', 'old_percentage', 'new_percentage', 'timestamp', 'notes']

    def get_target_name(self, obj):
        if obj.target_type == 'user' and obj.target_user:
            return obj.target_user.full_name
        return "الكل (عام)"

class DashboardCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerUser
        fields = (
            'id', 'full_name', 'phone', 'email',
            'is_phone_verified', 'is_email_verified',
            'date_joined', 'phone_verified_at', 'email_verified_at',
            'notes', 'is_suspended', 'suspension_reason', 'custom_notification',
            'is_discount_active', 'special_discount_percentage', 'discount_applies_to_services',
            'discount_start_date', 'discount_end_date', 'discount_custom_message',
            'special_discount_type', 'special_discount_amount', 'discount_max_animals',
            'discount_used_animals', 'global_discount_used_animals',
            'is_corporate', 'business_name', 'allow_global_discount',
            'is_restricted', 'restriction_reason'
        )

class EmployeeTokenObtainPairSerializer(BaseTokenSerializer):
    def validate(self, attrs):
        identifier = attrs.get('phone')
        password = attrs.get('password')

        backend = EmployeeBackend()
        user = backend.authenticate(request=self.context.get('request'), username=identifier, password=password)

        if not user:
            raise serializers.ValidationError(_('فشل تسجيل الدخول. تحقق من البيانات أو وقت الدخول المسموح.'))

        refresh = self.get_token(user)
        module_access = get_all_user_access(user)

        data = {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user_info': EmployeeSerializer(user, context=self.context).data,
            'module_access': module_access,
            'is_superuser': user.is_superuser
        }
        self.user = user
        return data

class SupplierSerializer(serializers.ModelSerializer):
    supplier_type_display = serializers.CharField(source='get_supplier_type_display', read_only=True)
    active_animals_count = serializers.SerializerMethodField()
    active_animals_codes = serializers.SerializerMethodField()
    total_owed = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    balance = serializers.SerializerMethodField()
    contracts = serializers.SerializerMethodField()
    is_contract_signed = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'phone', 'email', 'address',
            'supplier_type', 'supplier_type_display',
            'item_supplied_description', 'items_supplied',
            'contact_persons', 'additional_contacts',
            'active_animals_count', 'active_animals_codes',
            'total_owed', 'total_paid', 'balance', 'contracts',
            'is_contract_signed'
        ]

    def get_active_animals_count(self, obj):
        if obj.supplier_type == 'LIVESTOCK_FARM':
            return obj.animal_set.filter(status__in=['sold', 'reserved']).count()
        return 0

    def get_active_animals_codes(self, obj):
        if obj.supplier_type == 'LIVESTOCK_FARM':
            animals = obj.animal_set.filter(status__in=['available', 'reserved']).order_by('-id')[:20]
            return [animal.code for animal in animals]
        return []

    def get_total_owed(self, obj):
        if obj.supplier_type == 'LIVESTOCK_FARM':
            return obj.animal_set.filter(status__in=['sold', 'reserved']).aggregate(total=Sum('purchase_price'))['total'] or 0
        else:
            received_orders = obj.purchaseorder_set.filter(status='received')
            total = received_orders.aggregate(
                total=Sum(F('items__quantity') * F('items__unit_price'), output_field=DecimalField())
            )['total'] or 0
            return total

    def get_total_paid(self, obj):
        return obj.payments.aggregate(total=Sum('amount'))['total'] or 0

    def get_balance(self, obj):
        return self.get_total_owed(obj) - self.get_total_paid(obj)

    def get_contracts(self, obj):
        request = self.context.get('request')
        return [
            {
                "id": d.id,
                "title": d.title,
                "file": request.build_absolute_uri(d.file.url) if d.file and request else (d.file.url if d.file else None),
                "created_at": d.created_at
            } for d in obj.contracts.all().order_by('-created_at')
        ]

    def get_is_contract_signed(self, obj):
        return obj.contracts.exists()

class InventoryItemSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    current_stock = serializers.DecimalField(max_digits=12, decimal_places=3, read_only=True)
    supplier_details = SupplierSerializer(source='supplier', read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            'id', 'name', 'type', 'type_display', 'unit_of_measure',
            'min_stock_level', 'current_stock', 'supplier', 'supplier_details'
        ]
        extra_kwargs = {
            'supplier': {'write_only': True, 'required': False, 'allow_null': True}
        }

class ManagementOrderItemSerializer(serializers.ModelSerializer):
    animal_code = serializers.CharField(source='animal.code', read_only=True)
    animal_weight = serializers.SerializerMethodField()
    is_adahi = serializers.BooleanField(source='animal.is_adahi_pool', read_only=True)
    animal_category = serializers.SerializerMethodField()
    share_quantity = serializers.IntegerField(read_only=True)
    source_farm_name = serializers.CharField(source='animal.source_farm.name', read_only=True, default='مزارعنا')
    supplier_code = serializers.CharField(source='animal.supplier_code', read_only=True)
    category_prices = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            'id', 'animal_code', 'animal_weight', 'animal_category', 'price_per_item',
            'deposit_per_item', 'service_cost', 'selected_services',
            'is_adahi', 'share_quantity', 'source_farm_name', 'supplier_code', 'listing_section',
            'original_weight', 'request_slaughter_video', 'slaughter_video', 'category_prices'
        ]

    def get_animal_weight(self, obj):
        return obj.animal.current_weight or 0

    def get_animal_category(self, obj):
        from django.utils.translation import get_language
        if obj.animal and obj.animal.category:
            return obj.animal.category.name_en if (get_language() == 'en' and obj.animal.category.name_en) else obj.animal.category.name_ar
        return ''

    def get_category_prices(self, obj):
        cat = obj.animal.category if obj.animal else None
        if cat:
            return {
                'slaughter_price': cat.slaughter_price,
                'cutting_price': cat.cutting_price,
                'packaging_price': cat.packaging_price,
                'enable_slaughter': cat.enable_slaughter,
                'enable_cutting': cat.enable_cutting,
                'enable_packaging': cat.enable_packaging,
            }
        return {}

class ManagementAddressSerializer(BaseAddressSerializer):
    user = serializers.PrimaryKeyRelatedField(queryset=CustomerUser.objects.all())

    class Meta(BaseAddressSerializer.Meta):
        read_only_fields = ()

class ManagementOrderSerializer(serializers.ModelSerializer):
    user = DashboardCustomerSerializer(read_only=True)
    items = ManagementOrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    delivery_address = BaseAddressSerializer(read_only=True)
    order_type_label = serializers.SerializerMethodField()
    min_deposit_required = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total_items_services = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    delivery_fee = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    documents = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields =[
            'id', 'user', 'status', 'status_display', 'created_at', 'updated_at',
            'total_price', 'deposit_total', 'remaining_amount', 'items', 'service_cost',
            'min_deposit_required', 'total_items_services', 'delivery_fee', 'applied_discount_amount',
            'delivery_type', 'source', 'delivery_date', 'payment_method',
            'delivery_address', 'has_slaughter_service', 'notes',
            'order_type_label',
            'signed_receipt_image', 'delivery_photo', 'documents',
            'pricing_model', 'payments'
        ]

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

    def get_documents(self, obj):
        request = self.context.get('request')
        return[
            {
                "id": d.id,
                "title": d.title,
                "file": request.build_absolute_uri(d.file.url) if d.file and request else (d.file.url if d.file else None),
                "created_at": d.created_at
            } for d in obj.documents.all().order_by('-created_at')
        ]

    def get_payments(self, obj):
        return obj.payments.all().values('id', 'amount', 'created_at', 'status', 'payment_method', 'transaction_id', 'recorded_by__full_name')

class OrderStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['status', 'delivery_date', 'notes']

class PasswordChangeLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()
    changed_by_id = serializers.SerializerMethodField()
    timestamp_formatted = serializers.SerializerMethodField()
    time_ago = serializers.SerializerMethodField()
    changed_by_department = serializers.CharField(source='changed_by.department.name', read_only=True, allow_null=True)

    class Meta:
        model = PasswordChangeLog
        fields = [
            'id', 'timestamp', 'timestamp_formatted', 'time_ago',
            'changed_by_id', 'changed_by_name', 'changed_by_department', 'ip_address', 'notes'
        ]

    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.full_name
        return "غير معروف"

    def get_changed_by_id(self, obj):
        if obj.changed_by:
            return obj.changed_by.id
        return None

    def get_timestamp_formatted(self, obj):
        if obj.timestamp:
            return timezone.localtime(obj.timestamp).strftime('%Y/%m/%d, %I:%M %p')
        return ""

    def get_time_ago(self, obj):
        if obj.timestamp:
            return timesince(obj.timestamp, timezone.now())
        return ""

class SalaryChangeLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.full_name', read_only=True, allow_null=True)
    changed_by_department = serializers.CharField(source='changed_by.department.name', read_only=True, allow_null=True)
    timestamp_formatted = serializers.SerializerMethodField()
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = SalaryChangeLog
        fields = [
            'id', 'timestamp', 'timestamp_formatted', 'time_ago',
            'changed_by_name', 'changed_by_department',
            'old_salary', 'new_salary'
        ]

    def get_timestamp_formatted(self, obj):
        if obj.timestamp:
            return timezone.localtime(obj.timestamp).strftime('%Y/%m/%d, %I:%M %p')
        return ""

    def get_time_ago(self, obj):
        if obj.timestamp:
            return timesince(obj.timestamp)
        return ""

class EmployeeStatusLogSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = EmployeeStatusLog
        fields = ['status', 'status_display', 'timestamp', 'reason']

class EmployeeSerializer(serializers.ModelSerializer):
    department_name = serializers.SerializerMethodField()
    role_name = serializers.SerializerMethodField()
    status_logs = EmployeeStatusLogSerializer(many=True, read_only=True)
    password_changes = PasswordChangeLogSerializer(many=True, read_only=True)
    salary_changes = SalaryChangeLogSerializer(many=True, read_only=True)
    national_id_image = serializers.ImageField(read_only=True)
    last_password_change_formatted = serializers.SerializerMethodField()
    last_password_change_ago = serializers.SerializerMethodField()
    documents = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            'id', 'full_name', 'employee_id', 'phone', 'department',
            'department_name', 'role', 'role_name', 'hire_date', 'is_active', 'is_superuser',
            'base_salary', 'national_id', 'birth_date', 'address',
            'national_id_image', 'status_logs', 'user_permissions',
            'shift_start', 'shift_end', 'session_duration', 'password',
            'password_changes', 'last_password_change', 'last_password_change_formatted',
            'last_password_change_ago', 'salary_changes', 'documents', 'allowed_chat_users',
            'is_chat_blocked'
        ]
        extra_kwargs = {
            'department': {'required': True, 'allow_null': False},
            'role': {'required': True, 'allow_null': False},
            'user_permissions': {'read_only': True},
            'password': {'write_only': True, 'required': False}
        }

    def get_department_name(self, obj):
        return obj.department.name if obj.department else '---'

    def get_role_name(self, obj):
        return obj.role.name if obj.role else '---'

    def get_last_password_change_formatted(self, obj):
        if obj.last_password_change:
            return timezone.localtime(obj.last_password_change).strftime('%Y/%m/%d, %I:%M %p')
        return None

    def get_last_password_change_ago(self, obj):
        if obj.last_password_change:
            return timesince(obj.last_password_change)
        return "لم يتم تغييره أبداً"

    def get_documents(self, obj):
        request = self.context.get('request')
        return [
            {
                "id": d.id,
                "title": d.title,
                "file": request.build_absolute_uri(d.file.url) if d.file and request else (d.file.url if d.file else None),
                "created_at": d.created_at
            } for d in obj.documents.all().order_by('-created_at')
        ]

    def update(self, instance, validated_data):
        validated_data.pop('user_permissions', None)
        password = validated_data.pop('password', None)
        allowed_chat_users = validated_data.pop('allowed_chat_users', None)

        request = self.context.get('request')
        new_salary = validated_data.get('base_salary')

        if new_salary is not None and Decimal(new_salary) != instance.base_salary:
            if request and request.user.id == instance.id and not request.user.is_superuser:
                raise serializers.ValidationError({"base_salary": "أسباب أمنية: لا يمكنك تعديل راتبك الأساسي بنفسك."})

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()

        if allowed_chat_users is not None:
            instance.allowed_chat_users.set(allowed_chat_users)

        return instance

class EmployeeCreationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    national_id_image = serializers.ImageField(required=True, write_only=True)

    class Meta:
        model = Employee
        fields = [
            'full_name', 'phone', 'password', 'department', 'role',
            'hire_date', 'is_active', 'employee_id',
            'base_salary', 'national_id', 'address', 'national_id_image'
        ]
        read_only_fields = ('employee_id',)

    def create(self, validated_data):
        password = validated_data.pop('password')

        employee = Employee.objects.create_user(
            password=password,
            **validated_data
        )

        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            PasswordChangeLog.objects.create(
                employee=employee,
                changed_by=request.user,
                ip_address=self.get_client_ip(request),
                notes="كلمة المرور الأولية عند إنشاء الحساب"
            )

        employee.last_password_change = timezone.now()
        employee.save(update_fields=['last_password_change'])

        return employee

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip

class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission

    def to_representation(self, instance):
        app_label = instance.content_type.app_label
        return f"{app_label}.{instance.codename}"

class HealthLogSerializer(serializers.ModelSerializer):
    vet_name = serializers.CharField(source='vet.full_name', read_only=True, default='N/A')
    log_type_display = serializers.CharField(source='get_log_type_display', read_only=True)

    class Meta:
        model = HealthLog
        fields = ['log_date', 'log_type_display', 'description', 'vet_name', 'cost']

class HealthLogCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthLog
        fields = ['log_date', 'log_type', 'description', 'cost']

    def create(self, validated_data):
        return super().create(validated_data)

class FeedingLogSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = FeedingLog
        fields = ['timestamp', 'item_name', 'quantity_kg', 'user_name', 'notes']

class WeightLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeightLog
        fields = ['date', 'weight_kg']

class AnimalProfileSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name_ar', read_only=True)
    health_logs = HealthLogSerializer(many=True, read_only=True)
    feeding_logs = FeedingLogSerializer(many=True, read_only=True)
    weight_logs = WeightLogSerializer(many=True, read_only=True)
    age_months = serializers.IntegerField(read_only=True)
    current_weight = serializers.DecimalField(max_digits=6, decimal_places=2, read_only=True, allow_null=True)
    mother_code = serializers.CharField(source='mother.code', read_only=True, default=None)
    father_code = serializers.CharField(source='father.code', read_only=True, default=None)

    class Meta:
        model = Animal
        fields = [
            'code', 'name', 'category_name', 'sex', 'birth_date', 'age_months',
            'breed', 'current_weight', 'status', 'description', 'image',
            'entry_type', 'mother_code', 'father_code', 'purchase_price',
            'health_logs', 'feeding_logs', 'weight_logs', 'location'
        ]

class FarmDepartmentSerializer(serializers.ModelSerializer):
    employee_count = serializers.SerializerMethodField()
    can_communicate_with = serializers.PrimaryKeyRelatedField(many=True, queryset=FarmDepartment.objects.all(), required=False)
    permissions = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Permission.objects.all(),
        required=False
    )

    class Meta:
        model = FarmDepartment
        fields = ['id', 'name', 'description', 'is_active', 'employee_count', 'permissions', 'shift_start', 'shift_end', 'session_duration', 'can_communicate_with']

    def get_employee_count(self, obj):
        return obj.employee_set.filter(is_active=True).count()

class RolePermissionStateSerializer(serializers.ModelSerializer):
    id = serializers.ReadOnlyField(source='permission.id')
    name = serializers.ReadOnlyField(source='permission.name')
    codename = serializers.ReadOnlyField(source='permission.codename')

    class Meta:
        model = RolePermission
        fields = ['id', 'name', 'codename', 'state']

class EmployeeRoleSerializer(serializers.ModelSerializer):
    permissions_state = RolePermissionStateSerializer(source='rolepermission_set', many=True, read_only=True)
    permissions = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Permission.objects.all(),
        required=False,
        write_only=True
    )
    employee_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = EmployeeRole
        fields = [
            'id', 'name', 'description', 'department',
            'max_discount_percent', 'permissions_state',
            'permissions', 'shift_start', 'shift_end',
            'session_duration', 'employee_count'
        ]

class EmployeePermissionUpdateSerializer(serializers.ModelSerializer):
    user_permissions = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Permission.objects.all(),
        required=False
    )

    class Meta:
        model = Employee
        fields = ['user_permissions', 'shift_start', 'shift_end', 'session_duration']

class ApprovalRequestSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source='requester.full_name', read_only=True)
    approver_name = serializers.CharField(source='approver.full_name', read_only=True)

    class Meta:
        model = ApprovalRequest
        fields = '__all__'
        read_only_fields = ('requester', 'status', 'resolved_at', 'resolution_notes')

class WeightLogCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeightLog
        fields = ['id', 'animal', 'date', 'weight_kg', 'recorded_by']
        read_only_fields = ('id', 'animal', 'recorded_by')

class FeedingLogCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedingLog
        fields = ['animal', 'item', 'quantity_kg', 'notes']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)

class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderItem
        fields = ['item', 'quantity', 'unit_price']

class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'supplier', 'supplier_name', 'status', 'created_by', 'created_by_name',
            'created_at', 'items'
        ]
        read_only_fields = ('created_by', 'status')

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        with transaction.atomic():
            validated_data['created_by'] = self.context['request'].user
            order = PurchaseOrder.objects.create(**validated_data)
            for item_data in items_data:
                PurchaseOrderItem.objects.create(order=order, **item_data)
        return order

class PayrollEntrySerializer(serializers.ModelSerializer):
    entry_type_display = serializers.CharField(source='get_entry_type_display', read_only=True)

    class Meta:
        model = PayrollEntry
        fields = ['id', 'entry_type', 'entry_type_display', 'description', 'amount']

class PayrollSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    entries = PayrollEntrySerializer(many=True, read_only=True)

    class Meta:
        model = Payroll
        fields = [
            'id', 'employee', 'employee_name', 'month', 'year',
            'net_salary', 'is_paid', 'paid_date', 'entries'
        ]

class PayrollCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payroll
        fields = ['employee', 'month', 'year']

class PayrollEntryCreateSerializer(serializers.Serializer):
    entry_type = serializers.ChoiceField(choices=PayrollEntry.ENTRY_TYPES)
    description = serializers.CharField(max_length=255, required=False, allow_blank=True)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)

class LookupSourcedRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpecialRequest
        fields = ['id', 'created_at', 'requested_specs']

class LookupOrderSerializer(serializers.ModelSerializer):
    items = ManagementOrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    documents = serializers.SerializerMethodField()
    business_request_info = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields =[
            'id', 'created_at', 'total_price', 'remaining_amount', 'status',
            'status_display', 'source', 'items',
            'signed_receipt_image', 'delivery_photo', 'documents',
            'business_request_info'
        ]

    def get_documents(self, obj):
        request = self.context.get('request')
        return[
            {
                "id": d.id,
                "title": d.title,
                "file": request.build_absolute_uri(d.file.url) if d.file and request else (d.file.url if d.file else None),
                "created_at": d.created_at
            } for d in obj.documents.all().order_by('-created_at')
        ]

    def get_business_request_info(self, obj):
        if obj.source == 'b2b' and hasattr(obj, 'business_source') and obj.business_source:
            b_req = obj.business_source
            total_qty = 0
            if isinstance(b_req.request_details, list):
                total_qty = sum(int(item.get('quantity') or 0) for item in b_req.request_details)
            return {
                'id': b_req.id,
                'total_quantity': total_qty,
                'quoted_deposit': b_req.quoted_deposit,
            }
        return None

class DocumentArchiveSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_phone = serializers.CharField(source='supplier.phone', read_only=True)
    b2b_customer_name = serializers.CharField(source='b2b_customer.business_name', read_only=True)
    b2b_customer_phone = serializers.CharField(source='b2b_customer.phone', read_only=True)
    employee_name = serializers.CharField(source='employee_file.full_name', read_only=True)
    employee_phone = serializers.CharField(source='employee_file.phone', read_only=True)
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)

    class Meta:
        model = DocumentArchive
        fields = '__all__'
        read_only_fields = ('uploaded_by', 'created_at')

    def create(self, validated_data):
        validated_data['uploaded_by'] = self.context['request'].user
        instance = super().create(validated_data)

        if instance.document_type == 'supplier_contract' and instance.supplier:
            instance.supplier.is_contract_signed = True
            instance.supplier.save(update_fields=['is_contract_signed'])

        if instance.document_type == 'order_doc' and instance.order:
            instance.order.signed_receipt_image = instance.file
            instance.order.save(update_fields=['signed_receipt_image'])
            if not instance.b2b_customer:
                instance.b2b_customer = instance.order.user
                instance.save(update_fields=['b2b_customer'])

        if instance.document_type == 'b2b_order_doc' and instance.business_request:
            if not instance.b2b_customer:
                instance.b2b_customer = instance.business_request.user
                instance.save(update_fields=['b2b_customer'])

        return instance

class CustomerNoteLogSerializer(serializers.ModelSerializer):
    added_by_name = serializers.CharField(source='added_by.full_name', read_only=True)
    added_by_dept = serializers.CharField(source='added_by.department.name', read_only=True)

    class Meta:
        model = CustomerNoteLog
        fields =['note', 'added_by_name', 'added_by_dept', 'created_at']

class CustomerSuspensionLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.full_name', read_only=True)
    changed_by_dept = serializers.CharField(source='changed_by.department.name', read_only=True)

    class Meta:
        model = CustomerSuspensionLog
        fields =['action', 'reason', 'changed_by_name', 'changed_by_dept', 'created_at']

class CustomerLookupSerializer(serializers.ModelSerializer):
    user_details = DashboardCustomerSerializer(source='*')
    discount_logs = DiscountLogSerializer(many=True, read_only=True)
    addresses = BaseAddressSerializer(many=True, read_only=True)
    orders = LookupOrderSerializer(many=True, read_only=True)
    sourced_special_requests = LookupSourcedRequestSerializer(source='special_requests', many=True, read_only=True)
    order_count = serializers.IntegerField(source='orders.count', read_only=True)
    b2b_contracts = DocumentArchiveSerializer(many=True, read_only=True)
    note_logs = CustomerNoteLogSerializer(many=True, read_only=True)
    suspension_logs = CustomerSuspensionLogSerializer(many=True, read_only=True)

    class Meta:
        model = CustomerUser
        fields =[
            'user_details', 'addresses', 'orders', 'sourced_special_requests', 'order_count', 'b2b_contracts',
            'note_logs', 'suspension_logs', 'discount_logs'
        ]

class OrderLedgerItemSerializer(serializers.ModelSerializer):
    animal_code = serializers.CharField(source='animal.code', read_only=True)

    class Meta:
        model = OrderItem
        fields = ['animal_code', 'price_per_item', 'service_cost', 'selected_services']

class OrderLedgerSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='user.full_name', read_only=True)
    customer_phone = serializers.CharField(source='user.phone', read_only=True)
    employee_name = serializers.CharField(source='created_by_employee.full_name', read_only=True, default='N/A')
    employee_department = serializers.CharField(source='created_by_employee.department.name', read_only=True, default='N/A')
    items = OrderLedgerItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    min_deposit_required = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'created_at', 'customer_name', 'customer_phone',
            'employee_name', 'employee_department', 'total_price',
            'deposit_total', 'remaining_amount', 'min_deposit_required', 'payment_method', 'status_display',
            'items'
        ]

class SimplePermissionSerializer(serializers.ModelSerializer):
    def to_representation(self, instance):
        app_label = instance.content_type.app_label
        model_class = instance.content_type.model_class()

        if model_class:
            model_meta = model_class._meta
            model_name_ar = getattr(model_meta, 'verbose_name', model_meta.model_name)
        else:
            model_name_ar = instance.content_type.model

        action_map = {
            'add': 'إضافة', 'change': 'تعديل', 'delete': 'حذف', 'view': 'عرض'
        }
        action = instance.codename.split('_')[0]
        action_ar = action_map.get(action, action)
        name_ar = f"{action_ar} ({model_name_ar})"

        return {
            'id': instance.id,
            'codename': f"{app_label}.{instance.codename}",
            'name': name_ar
        }

    class Meta:
        model = Permission
        fields = ['id', 'codename', 'name']

class SimpleEmployeeSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    role_name = serializers.CharField(source='role.name', read_only=True)

    class Meta:
        model = Employee
        fields = ['id', 'full_name', 'employee_id', 'department', 'department_name', 'role_name']

class ChatMessageSerializer(serializers.ModelSerializer):
    author = SimpleEmployeeSerializer(read_only=True)
    author_id = serializers.ReadOnlyField(source='author.id')

    class Meta:
        model = ChatMessage
        fields = ['id', 'author', 'author_id', 'content', 'attachment', 'timestamp', 'is_read', 'is_deleted', 'reactions']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        is_superuser = request and request.user and request.user.is_superuser

        if instance.is_deleted:
            if not is_superuser:
                data['content'] = '🚫 تم حذف هذه الرسالة'
                data['attachment'] = None
                data['reactions'] = {}
            else:
                deleter_name = instance.deleted_for_everyone_by.full_name if instance.deleted_for_everyone_by else 'مجهول'
                data['content'] = f"{instance.content}\n\n[🗑️ حُذفت للجميع بواسطة: {deleter_name}]"

        return data

class ChatRoomSerializer(serializers.ModelSerializer):
    participants = SimpleEmployeeSerializer(many=True, read_only=True)
    participants_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=Employee.objects.all(), source='participants'
    )
    allowed_writers_ids = serializers.PrimaryKeyRelatedField(
        many=True, write_only=True, queryset=Employee.objects.all(), source='allowed_writers', required=False
    )
    allowed_writers = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    latest_message = serializers.SerializerMethodField()
    messages_count = serializers.IntegerField(source='messages.count', read_only=True)
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = ['id', 'name', 'room_type', 'participants', 'participants_ids', 'allowed_writers', 'allowed_writers_ids', 'latest_message', 'messages_count', 'unread_count']

    def get_latest_message(self, obj):
        latest = obj.messages.order_by('-timestamp').first()
        if latest:
            return ChatMessageSerializer(latest, context=self.context).data
        return None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user:
            return obj.messages.filter(is_read=False).exclude(author=request.user).count()
        return 0

    def create(self, validated_data):
        participants = validated_data.pop('participants',[])
        allowed_writers = validated_data.pop('allowed_writers',[])
        user = self.context['request'].user

        if not user.is_superuser:
            allowed_depts = list(user.department.can_communicate_with.values_list('id', flat=True)) if user.department else[]
            if user.department:
                allowed_depts.append(user.department.id)
            allowed_users = list(user.allowed_chat_users.values_list('id', flat=True))

            for participant in participants:
                if participant.id == user.id:
                    continue
                participant_dept_id = participant.department.id if participant.department else None
                if participant_dept_id not in allowed_depts and participant.id not in allowed_users:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied(f"لا تملك صلاحية لإنشاء محادثة مع {participant.full_name}")

        participants_set = set(participants)
        participants_set.add(user)

        room = ChatRoom.objects.create(**validated_data)
        room.participants.set(list(participants_set))

        if allowed_writers:
            room.allowed_writers.set(allowed_writers)
            room.allowed_writers.add(user)

        return room

class ChangePasswordSerializer(serializers.Serializer):
    from django.contrib.auth.password_validation import validate_password
    new_password = serializers.CharField(required=True, validators=[validate_password])
    notes = serializers.CharField(required=False, allow_blank=True, max_length=255)

class AttendanceLogSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.full_name', read_only=True)

    class Meta:
        model = AttendanceLog
        fields = '__all__'
        read_only_fields = ('recorded_by',)

class StockMovementCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockMovement
        fields = ['item', 'quantity', 'movement_type', 'notes']

class OperationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = OperationSettings
        fields = '__all__'

class JobOpeningSerializer(serializers.ModelSerializer):
    application_count = serializers.IntegerField(read_only=True)
    is_open = serializers.BooleanField(read_only=True)

    class Meta:
        model = JobOpening
        fields = '__all__'

class JobApplicationSerializer(serializers.ModelSerializer):
    job_title = serializers.CharField(source='job.title', read_only=True)

    class Meta:
        model = JobApplication
        fields = '__all__'

class ManagementDeliveryAreaSerializer(serializers.ModelSerializer):
    governorate_name = serializers.CharField(source='governorate.name_ar', read_only=True)

    class Meta:
        model = DeliveryArea
        fields = ['id', 'governorate', 'governorate_name', 'delivery_price', 'is_active']

class ContactMessageSerializer(serializers.ModelSerializer):
    is_registered = serializers.SerializerMethodField()

    class Meta:
        model = ContactMessage
        fields = '__all__'

    def get_is_registered(self, obj):
        from .utils import normalize_phone
        normalized = normalize_phone(obj.phone)
        if normalized:
            return CustomerUser.objects.filter(phone=normalized).exists()
        return CustomerUser.objects.filter(phone=obj.phone).exists()

class CustomerCallLogSerializer(serializers.ModelSerializer):
    handled_by_name = serializers.CharField(source='handled_by.full_name', read_only=True)
    reason_display = serializers.CharField(source='get_reason_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = CustomerCallLog
        fields = '__all__'
        read_only_fields = ('handled_by', 'duration_seconds')

