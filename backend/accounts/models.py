import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractUser, Group, Permission
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from django.conf import settings

from .managers import UserManager

def otp_expiry_default():
    return timezone.now() + timedelta(minutes=2)

class User(AbstractUser):
    # Link to employee profile for superuser
    employee_profile = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customer_profile',
        verbose_name=_('ملف الموظف المرتبط')
    )

    # Basic fields
    phone_country = models.CharField(max_length=5, default='20', verbose_name=_('Country Code'))
    phone = models.CharField(max_length=20, unique=True, verbose_name=_('Phone (E.164)'))
    full_name = models.CharField(max_length=150, verbose_name=_('Full Name'))

    is_phone_verified = models.BooleanField(default=False, verbose_name=_("Phone Verified"))
    phone_verified_at = models.DateTimeField(null=True, blank=True, verbose_name=_("تاريخ توثيق الهاتف"))
    is_email_verified = models.BooleanField(default=False, verbose_name=_("Email Verified"))
    email_verified_at = models.DateTimeField(null=True, blank=True, verbose_name=_("تاريخ توثيق الإيميل"))
    email = models.EmailField(_('email address'), blank=True, null=True, unique=True)

    # Customer management
    last_cancel_reset_at = models.DateTimeField(null=True, blank=True, verbose_name=_("تاريخ تصفير عداد الإلغاء"))
    voucher_used_in_order_id = models.CharField(max_length=50, null=True, blank=True, verbose_name=_("رقم الطلب الذي استخدمت فيه القسيمة"))
    voucher_used_at = models.DateTimeField(null=True, blank=True, verbose_name=_("تاريخ استخدام القسيمة"))
    is_suspended = models.BooleanField(default=False, verbose_name=_("الحساب موقوف"))
    suspension_reason = models.TextField(blank=True, null=True, verbose_name=_("سبب الإيقاف"))
    is_restricted = models.BooleanField(default=False, verbose_name=_("مقيّد من الطلب"))
    restriction_reason = models.TextField(blank=True, null=True, verbose_name=_("سبب التقييد"))
    notes = models.TextField(blank=True, null=True, verbose_name=_("ملاحظات إدارية"))
    custom_notification = models.CharField(max_length=255, blank=True, null=True, verbose_name=_("إشعار مخصص للعميل"))

    # Corporate account fields
    is_corporate = models.BooleanField(
        default=False,
        verbose_name=_("حساب شركة/أعمال"),
        help_text=_("تفعيل هذا الخيار يعني أن العميل فندق، مطعم، أو جزارة")
    )
    business_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name=_("اسم النشاط التجاري")
    )

    # Advanced discount fields
    allow_global_discount = models.BooleanField(
        default=True,
        verbose_name=_("سماح بالخصم العام")
    )

    is_discount_active = models.BooleanField(
        default=False,
        verbose_name=_("تفعيل الخصم الخاص (يلغي العام)")
    )

    DISCOUNT_TYPE_CHOICES =[
        ('percentage', _('نسبة مئوية (%)')),
        ('fixed', _('مبلغ ثابت (ج.م)')),
    ]
    special_discount_type = models.CharField(
        max_length=10, choices=DISCOUNT_TYPE_CHOICES, default='percentage', verbose_name=_("نوع الخصم الخاص")
    )
    special_discount_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=0, verbose_name=_("مبلغ خصم خاص ثابت (ج.م)")
    )
    special_discount_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=0, verbose_name=_("نسبة خصم خاص (%)")
    )
    discount_applies_to_services = models.BooleanField(
        default=False, verbose_name=_("الخصم يشمل الخدمات")
    )
    discount_start_date = models.DateTimeField(null=True, blank=True, verbose_name=_("تاريخ بدء الخصم"))
    discount_end_date = models.DateTimeField(null=True, blank=True, verbose_name=_("تاريخ انتهاء الخصم"))
    discount_custom_message = models.CharField(
        max_length=255, blank=True, null=True, verbose_name=_("رسالة الشريط المخصصة")
    )

    # Usage limits for discounts
    discount_max_animals = models.PositiveIntegerField(
        default=0,
        verbose_name=_("أقصى عدد مواشي للخصم الخاص (0=مفتوح)")
    )
    discount_used_animals = models.PositiveIntegerField(
        default=0,
        verbose_name=_("المواشي المستخدمة (خصم خاص)")
    )
    global_discount_used_animals = models.PositiveIntegerField(
        default=0,
        verbose_name=_("المواشي المستخدمة (خصم عام)")
    )

    # ManyToMany fields with custom related_name to avoid clashes
    groups = models.ManyToManyField(
        Group,
        verbose_name=_('groups'),
        blank=True,
        help_text=_('The groups this user belongs to.'),
        related_name="customer_user_groups",
        related_query_name="user",
    )
    user_permissions = models.ManyToManyField(
        Permission,
        verbose_name=_('user permissions'),
        blank=True,
        help_text=_('Specific permissions for this user.'),
        related_name="customer_user_permissions",
        related_query_name="user",
    )

    USERNAME_FIELD = 'phone'
    REQUIRED_FIELDS = ['full_name']
    objects = UserManager()

    class Meta:
        verbose_name = _('User')
        verbose_name_plural = _('Users')

    def __str__(self):
        return self.full_name or self.phone

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.__class__.objects.normalize_email(self.email.strip())
            if self.email == '':
                self.email = None

        if not self.username:
            self.username = self.phone or str(uuid.uuid4().hex[:30])

        super().save(*args, **kwargs)

    @property
    def display_name(self):
        """Display name prefers business name for corporate accounts."""
        if self.is_corporate and self.business_name:
            return f"{self.business_name} ({self.full_name})"
        return self.full_name

    @property
    def is_valid_corporate_account(self):
        """Validate corporate account has a business name."""
        return self.is_corporate and self.business_name and len(self.business_name.strip()) > 0

class Address(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses', verbose_name=_('User'))
    governorate = models.CharField(max_length=100, verbose_name=_('Governorate'))
    city = models.CharField(max_length=100, verbose_name=_('City'))
    street = models.CharField(max_length=255, verbose_name=_('Street'))
    building_number = models.CharField(max_length=50, blank=True, null=True, verbose_name=_('Building Number'))
    apartment_number = models.CharField(max_length=50, blank=True, null=True, verbose_name=_('Apartment Number'))
    notes = models.TextField(blank=True, null=True, verbose_name=_('Notes'))
    is_default = models.BooleanField(default=False, verbose_name=_('Is Default'))

    class Meta:
        verbose_name = _('Address')
        verbose_name_plural = _('Addresses')
        ordering = ['-is_default', '-id']

    def __str__(self):
        return f"{self.street}, {self.city}, {self.governorate}"

    def save(self, *args, **kwargs):
        if self.is_default:
            Address.objects.filter(user=self.user, is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)

class OTP(models.Model):
    class OTPType(models.TextChoices):
        PHONE_VERIFICATION = 'PHONE_VERIFICATION', _('Phone Verification')
        EMAIL_VERIFICATION = 'EMAIL_VERIFICATION', _('Email Verification')
        PASSWORD_RESET = 'PASSWORD_RESET', _('Password Reset')

    key = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='otps')
    type = models.CharField(max_length=20, choices=OTPType.choices)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=otp_expiry_default)
    is_used = models.BooleanField(default=False)

    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at

    def __str__(self):
        return f"OTP for {self.user.phone} ({self.type})"

    class Meta:
        verbose_name = _('OTP')
        verbose_name_plural = _('OTPs')
        ordering = ['-created_at']

