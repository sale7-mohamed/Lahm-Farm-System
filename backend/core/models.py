from django.db import models
from django.utils.translation import gettext_lazy as _
from django.core.exceptions import ValidationError

class Country(models.Model):
    name_ar = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    code = models.CharField(max_length=5, unique=True)
    currency = models.CharField(max_length=10, default="EGP")
    is_default = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Country"
        verbose_name_plural = "Countries"

    def __str__(self):
        return f"{self.name_en} ({self.code})"

class Governorate(models.Model):
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name="governorates")
    name_ar = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)

    class Meta:
        verbose_name = "Governorate"
        verbose_name_plural = "Governorates"

    def __str__(self):
        return f"{self.name_en} - {self.country.code}"

class GlobalDiscountSettings(models.Model):
    is_active = models.BooleanField(default=False, verbose_name=_("تفعيل الخصم العام"))
    percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        verbose_name=_("نسبة الخصم العام (%)")
    )
    applies_to_services = models.BooleanField(
        default=False, verbose_name=_("يشمل الخدمات")
    )
    start_date = models.DateTimeField(
        null=True, blank=True, verbose_name=_("تاريخ البدء")
    )
    end_date = models.DateTimeField(
        null=True, blank=True, verbose_name=_("تاريخ الانتهاء")
    )
    ticker_message = models.CharField(
        max_length=255, blank=True, null=True,
        verbose_name=_("نص الشريط المتحرك")
    )
    max_animals_per_user = models.PositiveIntegerField(
        default=0,
        verbose_name=_("الحد الأقصى للمواشي لكل عميل (0=مفتوح)")
    )

    def clean(self):
        if self.is_active:
            if self.percentage < 0 or self.percentage > 100:
                raise ValidationError(_("نسبة الخصم يجب أن تكون بين 0 و 100"))
            if self.start_date and self.end_date and self.start_date > self.end_date:
                raise ValidationError(_("تاريخ البدء يجب أن يكون قبل تاريخ الانتهاء"))

    def save(self, *args, **kwargs):
        self.pk = 1
        self.clean()
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    class Meta:
        verbose_name = _("إعدادات الخصم العام")
        verbose_name_plural = _("إعدادات الخصم العام")

class OperationSettings(models.Model):
    enable_delivery_service = models.BooleanField(default=True, verbose_name=_("تفعيل خدمة التوصيل (المتجر)"))
    enable_farm_pickup = models.BooleanField(default=True, verbose_name=_("تفعيل الاستلام من المزرعة (المتجر)"))
    enable_internal_slaughter = models.BooleanField(default=True, verbose_name=_("تفعيل الذبح الداخلي (المجزر الخاص)"))
    enable_fridge_manager = models.BooleanField(default=True, verbose_name=_("تفعيل شاشة الثلاجة والتغليف"))
    enable_general_shares = models.BooleanField(default=True, verbose_name=_("تفعيل صفحة التشارك العام"))
    enable_slaughter_video_request = models.BooleanField(default=True, verbose_name=_("تفعيل طلب فيديو الذبح للعملاء"))
    enable_adahi_full = models.BooleanField(default=True, verbose_name=_("تفعيل تبويب أضحية كاملة"))
    enable_adahi_pool = models.BooleanField(default=True, verbose_name=_("تفعيل تبويب مسبح الأضاحي"))
    enable_adahi_group = models.BooleanField(default=True, verbose_name=_("تفعيل تبويب المجموعات الخاصة"))

    eid_adha_date = models.DateTimeField(null=True, blank=True, verbose_name=_("تاريخ عيد الأضحى القادم"))
    enable_eid_celebration = models.BooleanField(default=False, verbose_name=_("تفعيل وضع احتفال العيد (زينة)"))
    show_eid_timer = models.BooleanField(default=False, verbose_name=_("إظهار عداد العيد التنازلي"))

    enable_ramadan_celebration = models.BooleanField(default=False, verbose_name=_("تفعيل احتفال رمضان (زينة وفوانيس)"))
    ramadan_start_date = models.DateTimeField(null=True, blank=True, verbose_name=_("تاريخ بداية رمضان"))

    enable_eid_fitr_celebration = models.BooleanField(default=False, verbose_name=_("تفعيل احتفال عيد الفطر"))
    eid_fitr_start_date = models.DateTimeField(null=True, blank=True, verbose_name=_("تاريخ عيد الفطر"))

    is_adahi_season_active = models.BooleanField(default=False, verbose_name=_("تفعيل موسم الأضاحي (فتح الصفحة)"))

    min_business_order_quantity = models.PositiveIntegerField(default=5, verbose_name=_("أقل عدد رؤوس لطلب الشركات"))
    business_weight_margin = models.DecimalField(max_digits=5, decimal_places=2, default=5.0, verbose_name=_("هامش الوزن المقبول (كجم)"))

    enable_eid_receive_button = models.BooleanField(default=False, verbose_name=_("إظهار زر الاستلام أيام العيد"))

    SMS_PROVIDER_CHOICES = [
        ('whysms', 'WhySMS'),
        ('wesms', 'WE Business'),
        ('arpuplus', 'ArpuPlus'),
        ('mock', 'وهمي (Mock - للتجارب)'),
    ]
    otp_provider = models.CharField(
        max_length=20,
        choices=SMS_PROVIDER_CHOICES,
        default='whysms',
        verbose_name=_("مزود خدمة رسائل الـ OTP")
    )
    general_sms_provider = models.CharField(
        max_length=20,
        choices=SMS_PROVIDER_CHOICES,
        default='whysms',
        verbose_name=_("مزود خدمة الرسائل العامة (SMS)")
    )

    PRICING_MODEL_CHOICES = [
        ('care_fee', 'نظام الرعاية اليومية (سعر ثابت)'),
        ('live_weight', 'نظام الميزان الفعلي (القايم)'),
    ]
    pricing_model = models.CharField(
        max_length=20,
        choices=PRICING_MODEL_CHOICES,
        default='care_fee',
        verbose_name="نظام تسعير وتسليم المواشي"
    )

    delivery_limit_tolerance = models.PositiveIntegerField(
        default=2,
        verbose_name=_("نسبة التجاوز المسموحة للحد اليومي (رؤوس)")
    )

    def save(self, *args, **kwargs):
        self.pk = 1
        self.clean()

        old_instance = None
        try:
            old_instance = OperationSettings.objects.get(pk=1)
        except OperationSettings.DoesNotExist:
            pass

        super().save(*args, **kwargs)

        if old_instance:
            from notifications.utils import send_global_notification
            if not old_instance.enable_eid_celebration and self.enable_eid_celebration:
                send_global_notification(
                    title="🐑 عيد أضحى مبارك!",
                    message="أسرة متجر لَحِم تهنئكم بحلول عيد الأضحى المبارك. تقبل الله طاعتكم وأضاحيكم ✨",
                    category="general"
                )
            if not old_instance.enable_ramadan_celebration and self.enable_ramadan_celebration:
                send_global_notification(
                    title="🌙 رمضان كريم!",
                    message="أهلّ الله عليكم شهر رمضان باليُمن والإيمان. كل عام وأنتم بخير وصحة وعافية 🕌",
                    category="general"
                )
            if not old_instance.enable_eid_fitr_celebration and self.enable_eid_fitr_celebration:
                send_global_notification(
                    title="🎈 عيد فطر مبارك!",
                    message="تقبل الله صيامكم وقيامكم. نتمنى لكم عيد فطر سعيد ومبهج 🎊",
                    category="general"
                )

    def clean(self):
        if self.min_business_order_quantity < 1:
            raise ValidationError(_("أقل عدد رؤوس لطلب الشركات يجب أن يكون على الأقل 1"))
        if self.business_weight_margin < 0:
            raise ValidationError(_("هامش الوزن المقبول لا يمكن أن يكون سالباً"))
        if self.enable_eid_receive_button and not self.eid_adha_date:
            raise ValidationError(_("لا يمكن تفعيل زر الاستلام في العيد بدون تحديد تاريخ العيد أولاً."))

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    @property
    def days_to_eid(self):
        if not self.eid_adha_date:
            return None
        from datetime import datetime
        delta = (self.eid_adha_date.date() - datetime.now().date()).days
        return delta if delta >= 0 else None

    @property
    def days_to_eid_fitr(self):
        if not self.eid_fitr_start_date:
            return None
        from datetime import datetime
        delta = (self.eid_fitr_start_date.date() - datetime.now().date()).days
        return delta if delta >= 0 else None

    @property
    def days_in_ramadan(self):
        if not self.ramadan_start_date:
            return None
        from datetime import datetime, timedelta
        today = datetime.now().date()
        ramadan_start = self.ramadan_start_date.date()
        if today < ramadan_start:
            return None
        ramadan_end = ramadan_start + timedelta(days=29)
        if today <= ramadan_end:
            return (ramadan_end - today).days
        return None

    @property
    def business_settings_info(self):
        return {
            'min_quantity': self.min_business_order_quantity,
            'weight_margin': float(self.business_weight_margin),
            'is_active': self.is_adahi_season_active,
            'description': f"الحد الأدنى للطلب: {self.min_business_order_quantity} رأس، هامش الوزن: ±{self.business_weight_margin} كجم"
        }

    class Meta:
        verbose_name = _("إعدادات التشغيل")
        verbose_name_plural = _("إعدادات التشغيل")

