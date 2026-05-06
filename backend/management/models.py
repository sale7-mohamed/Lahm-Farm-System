from decimal import Decimal
from datetime import date, datetime, time, timedelta
import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.auth.models import (
    AbstractBaseUser, BaseUserManager, PermissionsMixin, Group, Permission
)
from django.conf import settings
from .utils import normalize_phone, extract_birth_date_from_nid
from django.utils import timezone
from accounts.models import User as CustomerUser
from django.core.validators import FileExtensionValidator

class EmployeeManager(BaseUserManager):
    def _create_user(self, phone, password, **extra_fields):
        normalized_phone = normalize_phone(phone)
        if not normalized_phone:
            raise ValueError(_('صيغة رقم الهاتف غير صحيحة.'))

        email = extra_fields.get('email')
        if email:
            email = self.normalize_email(email)
            extra_fields['email'] = email

        username = extra_fields.get('username')
        if not username:
            username = str(uuid.uuid4().hex[:30])
        extra_fields['username'] = username

        employee = self.model(phone=normalized_phone, **extra_fields)
        employee.set_password(password)
        employee.save(using=self._db)
        return employee

    def create_user(self, phone, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(phone, password, **extra_fields)

    def create_superuser(self, phone, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))

        return self._create_user(phone, password, **extra_fields)

class FarmDepartment(models.Model):
    name = models.CharField(max_length=100, verbose_name=_("اسم القسم"))
    description = models.TextField(blank=True, verbose_name=_("وصف القسم"))
    is_active = models.BooleanField(default=True, verbose_name=_("نشط"))

    shift_start = models.TimeField(null=True, blank=True, verbose_name=_("بداية الوردية"))
    shift_end = models.TimeField(null=True, blank=True, verbose_name=_("نهاية الوردية"))
    session_duration = models.PositiveIntegerField(
        default=0,
        help_text=_("مدة الجلسة بالساعات (0 تعني الافتراضي)"),
        verbose_name=_("مدة الجلسة (ساعة)")
    )

    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        verbose_name=_("صلاحيات القسم الافتراضية")
    )

    can_communicate_with = models.ManyToManyField(
        'self',
        blank=True,
        symmetrical=False,
        verbose_name=_("الأقسام المسموح بالتواصل معها")
    )

    class Meta:
        verbose_name = _("Farm Department")
        verbose_name_plural = _("Farm Departments")
        permissions = [
            ("view_dashboard", "Can view management dashboard"),
            ("view_advanced_reports", "Can view advanced KPI reports")
        ]

    def __str__(self):
        return self.name

class EmployeeRole(models.Model):
    name = models.CharField(max_length=100, verbose_name=_("المسمى الوظيفي"))
    description = models.TextField(blank=True, null=True, verbose_name=_("الوصف"))
    department = models.ForeignKey(
        FarmDepartment,
        on_delete=models.CASCADE,
        related_name='roles',
        verbose_name=_("القسم")
    )

    shift_start = models.TimeField(null=True, blank=True, verbose_name=_("بداية الوردية"))
    shift_end = models.TimeField(null=True, blank=True, verbose_name=_("نهاية الوردية"))
    session_duration = models.PositiveIntegerField(
        default=0,
        help_text=_("مدة الجلسة بالساعات (0 تعني وراثة من القسم)"),
        verbose_name=_("مدة الجلسة (ساعة)")
    )

    permissions = models.ManyToManyField(
        'auth.Permission',
        through='RolePermission',
        blank=True,
        verbose_name=_("الصلاحيات")
    )
    max_discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name=_("أقصى نسبة خصم مسموحة (%)")
    )

    class Meta:
        verbose_name = _("دور الموظف")
        verbose_name_plural = _("أدوار الموظفين")

    def __str__(self):
        return f"{self.name} ({self.department.name})"

class RolePermission(models.Model):
    class PermissionState(models.TextChoices):
        ALLOW = 'ALLOW', _('ممنوح')
        REQUIRE_APPROVAL = 'REQUIRE_APPROVAL', _('يتطلب موافقة')

    role = models.ForeignKey(EmployeeRole, on_delete=models.CASCADE)
    permission = models.ForeignKey('auth.Permission', on_delete=models.CASCADE)
    state = models.CharField(
        max_length=20,
        choices=PermissionState.choices,
        default=PermissionState.ALLOW
    )

    class Meta:
        unique_together = ('role', 'permission')
        verbose_name = _("صلاحية دور")
        verbose_name_plural = _("صلاحيات الأدوار")

class Employee(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(max_length=150, unique=True, blank=True, null=True)
    full_name = models.CharField(max_length=150, verbose_name=_('الاسم الكامل'))
    employee_id = models.CharField(max_length=20, unique=True, verbose_name=_("رقم الموظف"), blank=True, null=True)
    phone = models.CharField(max_length=20, unique=True, verbose_name=_('رقم الهاتف'))
    email = models.EmailField(_('email address'), blank=True, null=True, unique=True)

    national_id = models.CharField(max_length=14, unique=True, verbose_name=_("الرقم القومي"))
    birth_date = models.DateField(verbose_name=_("تاريخ الميلاد"), null=True, blank=True, editable=False)
    address = models.TextField(verbose_name=_('العنوان التفصيلي'))
    national_id_image = models.ImageField(upload_to='national_ids/', verbose_name=_("صورة البطاقة"), null=True, blank=True)

    is_phone_verified = models.BooleanField(default=True, verbose_name=_("Phone Verified"))
    is_email_verified = models.BooleanField(default=True, verbose_name=_("Email Verified"))

    department = models.ForeignKey(FarmDepartment, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_("القسم"))
    role = models.ForeignKey(EmployeeRole, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_("الدور"))
    hire_date = models.DateField(verbose_name=_("تاريخ التعيين"), default=date.today)

    base_salary = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_("الراتب الأساسي"))

    shift_start = models.TimeField(null=True, blank=True, verbose_name=_("بداية الوردية (مخصص)"))
    shift_end = models.TimeField(null=True, blank=True, verbose_name=_("نهاية الوردية (مخصص)"))
    session_duration = models.PositiveIntegerField(
        default=0,
        help_text=_("مدة الجلسة بالساعات (0 تعني وراثة)"),
        verbose_name=_("مدة الجلسة (ساعة)")
    )

    is_active = models.BooleanField(default=True, verbose_name=_("نشط"))
    is_staff = models.BooleanField(default=True, verbose_name=_("عضو فريق عمل"))
    deactivation_reason = models.TextField(blank=True, null=True, verbose_name=_("سبب إلغاء التفعيل"))
    groups = models.ManyToManyField(
        Group,
        verbose_name=_('groups'),
        blank=True,
        related_name="employee_groups",
        related_query_name="employee"
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name=_('user permissions'),
        blank=True,
        related_name="employee_user_permissions",
        related_query_name="employee"
    )
    allowed_chat_users = models.ManyToManyField(
        'self',
        blank=True,
        symmetrical=False,
        verbose_name="موظفين مسموح بالتواصل معهم استثنائياً"
    )

    last_password_change = models.DateTimeField(null=True, blank=True, verbose_name=_("آخر تغيير لكلمة المرور"))
    password_expiry_days = models.PositiveIntegerField(default=90, verbose_name=_("مدة صلاحية كلمة المرور (أيام)"))

    is_chat_blocked = models.BooleanField(default=False, verbose_name=_("موقوف من الشات"))

    objects = EmployeeManager()

    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = ['full_name', 'national_id']

    class Meta:
        verbose_name = _("Employee")
        verbose_name_plural = _("Employees")

    def __str__(self):
        return f"{self.full_name} ({self.employee_id or self.phone})"

    def get_effective_session_duration(self):
        duration_hours = 0
        if self.session_duration > 0:
            duration_hours = self.session_duration
        elif self.role and self.role.session_duration > 0:
            duration_hours = self.role.session_duration
        elif self.department and self.department.session_duration > 0:
            duration_hours = self.department.session_duration

        return duration_hours * 60

    def save(self, *args, **kwargs):
        if not self.phone:
            raise ValueError("Phone number is required for an employee.")

        self.phone = normalize_phone(self.phone) or self.phone

        if not self.username:
            self.username = self.phone or str(uuid.uuid4().hex[:30])

        if self.email:
            self.email = self.__class__.objects.normalize_email(self.email.strip())
            if self.email == '':
                self.email = None

        if self.national_id:
            self.birth_date = extract_birth_date_from_nid(self.national_id)

        if not self.employee_id and self.department:
            hire_date = self.hire_date or date.today()
            day_str = f"{hire_date.day:02d}"
            month_str = f"{hire_date.month}"
            year_str = hire_date.strftime('%y')
            department_id_str = f"{self.department.id:02d}"
            sequence_count = Employee.objects.filter(
                department=self.department,
                hire_date__year=hire_date.year,
                hire_date__month=hire_date.month,
                hire_date__day=hire_date.day
            ).count()
            sequence_num = sequence_count + 1
            sequence_str = f"{sequence_num:02d}"
            self.employee_id = f"{sequence_str}{department_id_str}{day_str}{month_str}{year_str}"

        super().save(*args, **kwargs)

class EmployeeStatusLog(models.Model):
    STATUS_CHOICES = [
        ('hired', _('تم التعيين')),
        ('activated', _('تم التفعيل')),
        ('deactivated', _('تم إلغاء التفعيل'))
    ]
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='status_logs')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    changed_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    reason = models.TextField(blank=True, null=True, verbose_name=_("السبب"))

    class Meta:
        verbose_name = _("سجل حالة الموظف")
        verbose_name_plural = _("سجلات حالة الموظفين")
        ordering = ['-timestamp']

class PasswordChangeLog(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='password_changes', verbose_name=_("الموظف"))
    changed_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, related_name='changed_passwords', verbose_name=_("قام بالتغيير"))
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name=_("وقت التغيير"))
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name=_("عنوان IP"))
    mac_address = models.CharField(max_length=17, null=True, blank=True, verbose_name=_("MAC Address"))
    notes = models.CharField(max_length=255, blank=True, verbose_name=_("ملاحظات"))

    class Meta:
        verbose_name = _("سجل تغيير كلمة المرور")
        verbose_name_plural = _("سجلات تغيير كلمات المرور")
        ordering = ['-timestamp']

class SalaryChangeLog(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='salary_changes', verbose_name=_("الموظف"))
    changed_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, related_name='+', verbose_name=_("قام بالتغيير"))
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name=_("وقت التغيير"))
    old_salary = models.DecimalField(max_digits=10, decimal_places=2, verbose_name=_("الراتب القديم"))
    new_salary = models.DecimalField(max_digits=10, decimal_places=2, verbose_name=_("الراتب الجديد"))

    class Meta:
        verbose_name = _("سجل تغيير الراتب")
        verbose_name_plural = _("سجلات تغيير الرواتب")
        ordering = ['-timestamp']

class DiscountLog(models.Model):
    TARGET_CHOICES = [
        ('user', 'عميل محدد'),
        ('global', 'خصم عام')
    ]

    target_type = models.CharField(max_length=10, choices=TARGET_CHOICES)
    target_user = models.ForeignKey(CustomerUser, on_delete=models.CASCADE, null=True, blank=True, related_name='discount_logs')

    changed_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, verbose_name=_("قام بالتغيير"))
    department_snapshot = models.CharField(max_length=100, blank=True, verbose_name=_("القسم وقت التغيير"))

    old_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    new_percentage = models.DecimalField(max_digits=5, decimal_places=2)

    timestamp = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = _("سجل الخصومات")
        verbose_name_plural = _("سجلات الخصومات")
        ordering = ['-timestamp']

    def save(self, *args, **kwargs):
        if self.changed_by and self.changed_by.department:
            self.department_snapshot = self.changed_by.department.name
        super().save(*args, **kwargs)

class AttendanceLog(models.Model):
    STATUS_CHOICES = [
        ('present', 'حضور'),
        ('absent', 'غياب'),
        ('late', 'تأخير'),
        ('leave', 'أجازة'),
    ]
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='attendance_logs', verbose_name=_("الموظف"))
    date = models.DateField(default=date.today, verbose_name=_("التاريخ"))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='present', verbose_name=_("الحالة"))
    check_in_time = models.TimeField(null=True, blank=True, verbose_name=_("وقت الحضور"))
    check_out_time = models.TimeField(null=True, blank=True, verbose_name=_("وقت الانصراف"))
    notes = models.TextField(blank=True, verbose_name=_("ملاحظات"))
    recorded_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, related_name='+', verbose_name=_("قام بالتسجيل"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("سجل حضور")
        verbose_name_plural = _("سجلات الحضور")
        unique_together = ('employee', 'date')
        ordering = ['-date']

class Supplier(models.Model):
    class SupplierType(models.TextChoices):
        LIVESTOCK_FARM = 'LIVESTOCK_FARM', _('مزرعة مواشي')
        GENERAL_SUPPLIER = 'GENERAL_SUPPLIER', _('مورد عام')

    supplier_type = models.CharField(
        max_length=20,
        choices=SupplierType.choices,
        default=SupplierType.GENERAL_SUPPLIER,
        verbose_name=_("نوع المورد")
    )
    name = models.CharField(max_length=255, verbose_name=_("اسم المورد / المزرعة"))
    phone = models.CharField(max_length=20, blank=True, verbose_name=_("رقم الهاتف الأساسي"))
    email = models.EmailField(blank=True, null=True, verbose_name=_("البريد الإلكتروني"))
    address = models.TextField(blank=True, verbose_name=_("العنوان"))

    item_supplied_description = models.TextField(
        blank=True,
        verbose_name=_("ماذا يورد (وصف)"),
        help_text=_("خاص بالمورد العام (أعلاف، أدوية..)")
    )
    items_supplied = models.ManyToManyField(
        'InventoryItem',
        blank=True,
        related_name='suppliers',
        verbose_name=_("الأصناف التي يوردها (للمورد العام)")
    )

    contact_persons = models.CharField(
        max_length=255,
        blank=True,
        verbose_name=_("أسماء المسؤولين"),
        help_text=_("خاص بمزارع المواشي")
    )
    additional_contacts = models.TextField(
        blank=True,
        verbose_name=_("أرقام تواصل إضافية"),
        help_text=_("يمكنك إضافة أرقام هواتف متعددة هنا، كل رقم في سطر.")
    )

    is_contract_signed = models.BooleanField(default=False, verbose_name="تم توقيع العقد ورفعه")

    def __str__(self):
        return f"{self.name} ({self.get_supplier_type_display()})"

class SupplierPayment(models.Model):
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='payments', verbose_name="المورد")
    amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="المبلغ المدفوع")
    date = models.DateTimeField(auto_now_add=True, verbose_name="تاريخ الدفع")
    recorded_by = models.ForeignKey('Employee', on_delete=models.SET_NULL, null=True, verbose_name="الموظف")
    notes = models.TextField(blank=True, verbose_name="ملاحظات")
    receipt_image = models.ImageField(upload_to='supplier_receipts/', null=True, blank=True, verbose_name="صورة الإيصال/التحويل")

    class Meta:
        ordering = ['-date']

class InventoryItem(models.Model):
    ITEM_TYPE_CHOICES = [
        ('feed', _('علف')),
        ('medicine', _('دواء')),
        ('consumable', _('مستهلكات')),
        ('equipment', _('معدات'))
    ]
    name = models.CharField(max_length=255, verbose_name=_("اسم الصنف"))
    type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES, verbose_name=_("نوع الصنف"))
    unit_of_measure = models.CharField(
        max_length=50,
        verbose_name=_("وحدة القياس"),
        help_text=_("مثال: كجم، طن، لتر، علبة")
    )
    min_stock_level = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=100,
        verbose_name=_("حد الطلب الأدنى")
    )
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='primary_inventory_items',
        verbose_name=_("المورد الأساسي")
    )

    @property
    def current_stock(self):
        total_stock = self.lots.aggregate(total=models.Sum('remaining_quantity'))['total']
        return total_stock or Decimal('0.000')

    def __str__(self):
        return self.name

class InventoryLot(models.Model):
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='lots')
    purchase_order = models.ForeignKey('PurchaseOrder', on_delete=models.SET_NULL, null=True, blank=True)
    lot_number = models.CharField(max_length=100, blank=True, null=True)
    expiry_date = models.DateField(blank=True, null=True)
    initial_quantity = models.DecimalField(max_digits=12, decimal_places=3)
    remaining_quantity = models.DecimalField(max_digits=12, decimal_places=3)
    created_at = models.DateTimeField(auto_now_add=True)

class StockMovement(models.Model):
    MOVEMENT_TYPE_CHOICES = [
        ('purchase', _('استلام مشتريات')),
        ('feeding', _('صرف تغذية')),
        ('treatment', _('صرف علاج')),
        ('adjustment_in', _('تسوية إضافة')),
        ('adjustment_out', _('تسوية خصم/تالف'))
    ]
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name='movements', verbose_name=_("الصنف"))
    lot = models.ForeignKey(InventoryLot, on_delete=models.SET_NULL, null=True, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=3, verbose_name=_("الكمية"))
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPE_CHOICES, verbose_name=_("نوع الحركة"))
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name=_("وقت الحركة"))
    notes = models.TextField(blank=True, null=True, verbose_name=_("ملاحظات"))
    user = models.ForeignKey('Employee', on_delete=models.SET_NULL, null=True, verbose_name=_("المسؤول"))

class WeightLog(models.Model):
    animal = models.ForeignKey('livestock.Animal', on_delete=models.CASCADE, related_name='weight_logs')
    date = models.DateField(default=date.today, verbose_name=_("تاريخ الوزن"))
    weight_kg = models.DecimalField(max_digits=6, decimal_places=2, verbose_name=_("الوزن (كجم)"))
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-date']
        verbose_name = _("سجل وزن")
        verbose_name_plural = _("سجلات الأوزان")

class FeedingRule(models.Model):
    category = models.ForeignKey('livestock.Category', on_delete=models.CASCADE, verbose_name=_("فئة الحيوان"))
    min_weight_kg = models.PositiveIntegerField(verbose_name=_("أقل وزن (كجم)"))
    max_weight_kg = models.PositiveIntegerField(verbose_name=_("أقصى وزن (كجم)"))
    feed_percentage_of_body_weight = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('2.5'),
        verbose_name=_("نسبة العلف من وزن الجسم (%)")
    )

class HealthLog(models.Model):
    animal = models.ForeignKey('livestock.Animal', on_delete=models.CASCADE, related_name='health_logs', verbose_name=_("الحيوان"))
    log_date = models.DateField(verbose_name=_("تاريخ السجل"))
    log_type = models.CharField(
        max_length=100,
        choices=[('vaccination', _('تطعيم')), ('treatment', _('علاج')), ('observation', _('ملاحظة'))],
        verbose_name=_("نوع السجل")
    )
    description = models.TextField(verbose_name=_("الوصف/الدواء المستخدم"))
    vet = models.ForeignKey('Employee', on_delete=models.SET_NULL, null=True, blank=True, limit_choices_to={'role__name__icontains': 'طبيب'})
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_("تكلفة العلاج/الدواء"))

class FeedingLog(models.Model):
    animal = models.ForeignKey('livestock.Animal', on_delete=models.CASCADE, related_name='feeding_logs', verbose_name=_("الحيوان"))
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT, limit_choices_to={'type': 'feed'}, verbose_name=_("نوع العلف"))
    quantity_kg = models.DecimalField(max_digits=8, decimal_places=2, verbose_name=_("الكمية (كجم)"))
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name=_("وقت التغذية"))
    user = models.ForeignKey('Employee', on_delete=models.SET_NULL, null=True, verbose_name=_("الموظف المسؤول"))
    notes = models.TextField(blank=True, null=True, verbose_name=_("ملاحظات"))

    class Meta:
        verbose_name = _("سجل تغذية")
        verbose_name_plural = _("سجلات التغذية")
        ordering = ['-timestamp']

class PurchaseOrder(models.Model):
    STATUS_CHOICES = [
        ('draft', 'مسودة'),
        ('pending_approval', 'بانتظار الموافقة'),
        ('approved', 'تمت الموافقة'),
        ('rejected', 'مرفوض'),
        ('received', 'تم الاستلام')
    ]
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    approval_request = models.OneToOneField('ApprovalRequest', on_delete=models.SET_NULL, null=True, blank=True)
    created_by = models.ForeignKey('Employee', on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

class PurchaseOrderItem(models.Model):
    order = models.ForeignKey(PurchaseOrder, related_name='items', on_delete=models.CASCADE)
    item = models.ForeignKey(InventoryItem, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=12, decimal_places=3)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)

class Payroll(models.Model):
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='payrolls', verbose_name=_("الموظف"))
    month = models.PositiveIntegerField(verbose_name=_("الشهر"))
    year = models.PositiveIntegerField(verbose_name=_("السنة"))
    net_salary = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_("صافي الراتب"))
    is_paid = models.BooleanField(default=False, verbose_name=_("تم الدفع"))
    paid_date = models.DateField(null=True, blank=True, verbose_name=_("تاريخ الدفع"))

    class Meta:
        unique_together = ('employee', 'month', 'year')
        verbose_name = _("مسير رواتب")
        verbose_name_plural = _("مسيرات الرواتب")

class PayrollEntry(models.Model):
    ENTRY_TYPES = [
        ('allowance', 'بدل'),
        ('deduction', 'خصم'),
        ('base_salary', 'راتب أساسي'),
        ('advance', 'سلفة')
    ]
    payroll = models.ForeignKey(Payroll, on_delete=models.CASCADE, related_name='entries')
    entry_type = models.CharField(max_length=20, choices=ENTRY_TYPES)
    description = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)

class ChatRoom(models.Model):
    ROOM_TYPES = [
        ('DIRECT', 'محادثة فردية'),
        ('GROUP', 'مجموعة'),
        ('DEPARTMENT', 'غرفة قسم'),
    ]
    name = models.CharField(max_length=255, blank=True, null=True, verbose_name=_("اسم الغرفة"))
    room_type = models.CharField(max_length=20, choices=ROOM_TYPES, default='DIRECT', verbose_name=_("نوع الغرفة"))
    participants = models.ManyToManyField(Employee, related_name='chat_rooms', verbose_name=_("المشاركون"))
    allowed_writers = models.ManyToManyField(Employee, related_name='writable_rooms', blank=True, verbose_name=_("المسموح لهم بالكتابة"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("غرفة محادثة")
        verbose_name_plural = _("غرف المحادثات")
        ordering = ['-created_at']

    def __str__(self):
        return self.name or f"Room {self.id}"

class ChatMessage(models.Model):
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name='messages', verbose_name=_("الغرفة"))
    author = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='messages', verbose_name=_("المرسل"))
    content = models.TextField(verbose_name=_("المحتوى"), blank=True, null=True)
    from django.core.validators import FileExtensionValidator
    attachment = models.FileField(upload_to='chat_attachments/', null=True, blank=True, verbose_name=_("المرفق"), validators=[FileExtensionValidator(allowed_extensions=['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'])])

    is_deleted = models.BooleanField(default=False, verbose_name=_("محذوفة للجميع"))
    deleted_at = models.DateTimeField(null=True, blank=True, verbose_name=_("تاريخ الحذف للجميع"))
    deleted_for_everyone_by = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_everyone_msgs',
        verbose_name=_("من قام بالحذف للجميع")
    )
    deleted_for_users = models.ManyToManyField(
        Employee,
        blank=True,
        related_name='hidden_messages',
        verbose_name=_("حذفت لدى (فقط)")
    )

    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False, verbose_name=_("تمت القراءة"))
    reactions = models.JSONField(default=dict, blank=True, verbose_name=_("التفاعلات"))

    class Meta:
        verbose_name = _("رسالة محادثة")
        verbose_name_plural = _("رسائل المحادثات")
        ordering = ['timestamp']
        permissions = [
            ("can_delete_any_message", "Can delete any chat message"),
            ("can_view_all_chats", "Can view all chats"),
        ]

    def __str__(self):
        return f"Message from {self.author} in {self.room}"

class JobOpening(models.Model):
    JOB_TYPES = [
        ('Full-time', 'دوام كامل'),
        ('Part-time', 'دوام جزئي'),
        ('Contract', 'عقد مؤقت'),
        ('Remote', 'عن بعد'),
        ('Shift-based', 'ورديات'),
    ]

    title = models.CharField(max_length=200, verbose_name=_("المسمى الوظيفي"))
    job_type = models.CharField(max_length=50, choices=JOB_TYPES, default='Full-time', verbose_name=_("نوع الوظيفة"))
    location = models.CharField(max_length=200, verbose_name=_("الموقع"))
    description = models.TextField(verbose_name=_("وصف الوظيفة"))
    requirements = models.TextField(verbose_name=_("المتطلبات"), help_text=_("كل نقطة في سطر جديد"))
    salary_range = models.CharField(max_length=100, blank=True, null=True, verbose_name=_("نطاق الراتب"))

    vacancy_count = models.PositiveIntegerField(default=1, verbose_name=_("العدد المطلوب"))
    deadline = models.DateField(null=True, blank=True, verbose_name=_("آخر موعد للتقديم"))

    is_active = models.BooleanField(default=True, verbose_name=_("نشط (مفتوح للتقديم)"))
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    @property
    def application_count(self):
        return self.applications.count()

    @property
    def is_open(self):
        if not self.is_active:
            return False
        if self.deadline and date.today() > self.deadline:
            return False
        return True

class JobApplication(models.Model):
    job = models.ForeignKey(JobOpening, on_delete=models.CASCADE, related_name='applications', verbose_name=_("الوظيفة"))
    name = models.CharField(max_length=200, verbose_name=_("اسم المتقدم"))
    phone = models.CharField(max_length=20, verbose_name=_("رقم الهاتف"))
    email = models.EmailField(blank=True, null=True, verbose_name=_("البريد الإلكتروني"))
    cv_link = models.URLField(verbose_name=_("رابط السيرة الذاتية"))
    notes = models.TextField(blank=True, null=True, verbose_name=_("ملاحظات إضافية"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = _("طلب توظيف")
        verbose_name_plural = _("طلبات التوظيف")

    def __str__(self):
        return f"{self.name} - {self.job.title}"

class ContactMessage(models.Model):
    user = models.ForeignKey(CustomerUser, on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_("العميل المسجل"))
    name = models.CharField(max_length=150, verbose_name=_("الاسم"))
    phone = models.CharField(max_length=20, verbose_name=_("رقم الهاتف"))
    email = models.EmailField(blank=True, null=True, verbose_name=_("البريد الإلكتروني"))
    subject = models.CharField(max_length=255, verbose_name=_("الموضوع"))
    message = models.TextField(verbose_name=_("نص الرسالة"))
    is_read = models.BooleanField(default=False, verbose_name=_("تمت القراءة/الرد"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("تاريخ الإرسال"))

    class Meta:
        ordering = ['-created_at']
        verbose_name = _("رسالة تواصل")
        verbose_name_plural = _("رسائل التواصل")

class CustomerCallLog(models.Model):
    CALL_REASONS = [
        ('inquiry', 'استفسار عام'),
        ('order', 'بخصوص طلب/حجز'),
        ('complaint', 'شكوى/مشكلة'),
        ('partnership', 'طلب شراكة'),
        ('other', 'أخرى'),
    ]
    CALL_STATUS = [
        ('resolved', 'تم الحل/الانتهاء'),
        ('pending', 'قيد المتابعة'),
    ]

    customer_phone = models.CharField(max_length=20, verbose_name=_("رقم العميل"))
    customer_name = models.CharField(max_length=150, blank=True, null=True, verbose_name=_("اسم العميل"))
    reason = models.CharField(max_length=20, choices=CALL_REASONS, default='inquiry', verbose_name=_("سبب الاتصال"))
    status = models.CharField(max_length=20, choices=CALL_STATUS, default='resolved', verbose_name=_("حالة المكالمة"))
    notes = models.TextField(verbose_name=_("تفاصيل المكالمة وما تم فيها"))

    start_time = models.DateTimeField(verbose_name=_("بداية المكالمة"))
    end_time = models.DateTimeField(null=True, blank=True, verbose_name=_("نهاية المكالمة"))
    duration_seconds = models.PositiveIntegerField(default=0, verbose_name=_("مدة المكالمة بالثواني"))

    handled_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, verbose_name=_("الموظف المسؤول"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_time']
        verbose_name = _("سجل مكالمة")
        verbose_name_plural = _("سجلات المكالمات")

def document_archive_upload(instance, filename):
    import os
    base, ext = os.path.splitext(filename)
    clean_title = "".join(ch if ch.isalnum() else "_" for ch in str(instance.title))
    unique = uuid.uuid4().hex[:4]
    return f"document_archive/lahm_{instance.document_type}_{clean_title}_{unique}{ext.lower()}"

class DocumentArchive(models.Model):
    DOC_TYPES = [
        ('supplier_contract', 'عقد مورد / مزرعة'),
        ('b2b_contract', 'عقد تعاقد شركة / مطعم'),
        ('b2b_order_doc', 'إذن استلام طلب شركات (B2B)'),
        ('order_doc', 'إيصال استلام طلب أفراد عادي'),
        ('employee_doc', 'مستندات موظف (عقد/فيش/هوية)'),
        ('other', 'مستندات أخرى')
    ]
    title = models.CharField(max_length=255, verbose_name="عنوان المستند")
    document_type = models.CharField(max_length=50, choices=DOC_TYPES, verbose_name="نوع المستند")
    file = models.FileField(upload_to=document_archive_upload, verbose_name="الملف/الصورة", validators=[FileExtensionValidator(allowed_extensions=['pdf', 'jpg', 'jpeg', 'png', 'webp'])])

    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='contracts')
    business_request = models.ForeignKey('orders.BusinessRequest', on_delete=models.SET_NULL, null=True, blank=True, related_name='contracts')
    order = models.ForeignKey('orders.Order', on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    employee_file = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents', verbose_name="الموظف")
    b2b_customer = models.ForeignKey(CustomerUser, on_delete=models.SET_NULL, null=True, blank=True, related_name='b2b_contracts', verbose_name="العميل التجاري")
    external_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="اسم جهة/شخص خارجي")

    uploaded_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, related_name='+', verbose_name="تم الرفع بواسطة")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "أرشيف وثيقة"
        verbose_name_plural = "أرشيف الوثائق"

# ====================      ====================

class AccessLevel(models.TextChoices):
    NO_ACCESS = 'NO_ACCESS', 'لا يوجد وصول (مخفي)'
    VIEW_ONLY = 'VIEW_ONLY', 'رؤية فقط'
    FULL_ACCESS = 'FULL_ACCESS', 'تحكم كامل (إضافة/تعديل/حذف)'
    REQUIRE_APPROVAL = 'REQUIRE_APPROVAL', 'تعديل وحذف بموافقة'

class SystemModule(models.TextChoices):
    LIVESTOCK = 'livestock', 'إدارة المواشي'
    ORDERS = 'orders', 'المبيعات والطلبات'
    INVENTORY = 'inventory', 'المخزون والموردين'
    HR = 'hr', 'الموارد البشرية والرواتب'
    ACCOUNTING = 'accounting', 'المالية والمحاسبة'
    SETTINGS = 'settings', 'الإعدادات العامة'

class ModuleAccessRule(models.Model):
    module_name = models.CharField(max_length=50, choices=SystemModule.choices, verbose_name="وحدة النظام")
    department = models.ForeignKey(FarmDepartment, on_delete=models.CASCADE, null=True, blank=True, related_name='access_rules')
    role = models.ForeignKey(EmployeeRole, on_delete=models.CASCADE, null=True, blank=True, related_name='access_rules')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, null=True, blank=True, related_name='access_rules')
    actions = models.JSONField(default=dict, verbose_name="تفاصيل الصلاحيات")
    excluded_pages = models.JSONField(default=list, blank=True, null=True, verbose_name="الصفحات المحجوبة")

    class Meta:
        verbose_name = "قاعدة صلاحية"
        verbose_name_plural = "قواعد الصلاحيات"

class ApprovalRouting(models.Model):
    module_name = models.CharField(max_length=50, choices=SystemModule.choices, unique=True, verbose_name="وحدة النظام")
    designated_approver = models.ForeignKey(Employee, on_delete=models.CASCADE, verbose_name="المسؤول عن الموافقة")

    class Meta:
        verbose_name = "توجيه الموافقة"
        verbose_name_plural = "توجيهات الموافقات"

class ApprovalRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'قيد الانتظار'),
        ('approved', 'تمت الموافقة'),
        ('rejected', 'تم الرفض')
    ]
    requester = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='sent_approvals', verbose_name=_("مقدم الطلب"))
    approver = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='received_approvals', verbose_name=_("المسؤول عن الموافقة"))

    action_type = models.CharField(max_length=100, verbose_name=_("نوع الإجراء"))

    details = models.JSONField(default=dict, verbose_name=_("تفاصيل الطلب"))
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', verbose_name=_("الحالة"))
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True, verbose_name=_("ملاحظات القرار"))

    target_module = models.CharField(max_length=50, null=True, blank=True)
    target_object_id = models.CharField(max_length=50, null=True, blank=True)
    pending_data = models.JSONField(null=True, blank=True, help_text="البيانات الجديدة بانتظار الموافقة")

    class Meta:
        verbose_name = _("طلب موافقة")
        verbose_name_plural = _("طلبات الموافقات")
        ordering = ['-created_at']

class CustomerNoteLog(models.Model):
    customer = models.ForeignKey(CustomerUser, on_delete=models.CASCADE, related_name='note_logs', verbose_name=_("العميل"))
    note = models.TextField(verbose_name=_("الملاحظة"))
    added_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, verbose_name=_("الموظف"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

class CustomerSuspensionLog(models.Model):
    customer = models.ForeignKey(CustomerUser, on_delete=models.CASCADE, related_name='suspension_logs', verbose_name=_("العميل"))
    action = models.CharField(max_length=20, choices=[('suspended', 'إيقاف'), ('activated', 'تفعيل'), ('restricted', 'تقييد'), ('unrestricted', 'فك التقييد')], verbose_name=_("الإجراء"))
    reason = models.TextField(blank=True, null=True, verbose_name=_("السبب"))
    changed_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, verbose_name=_("الموظف"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

