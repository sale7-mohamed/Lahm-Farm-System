from decimal import Decimal
from django.db import models
from django.db.models import Sum
from django.utils.translation import gettext_lazy as _
from django.utils import timezone
from django.conf import settings
from livestock.models import Animal
from accounts.models import User as CustomerUser, Address
from core.models import GlobalDiscountSettings, OperationSettings

class Shipment(models.Model):
    STATUS_CHOICES = [
        ('pending', _('قيد التجهيز')),
        ('out_for_delivery', _('في الطريق')),
        ('completed', _('مكتملة')),
        ('cancelled', _('ملغاة')),
    ]

    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        verbose_name=_("المشرف المسؤول"),
        related_name='supervised_shipments'
    )
    driver_name = models.CharField(max_length=100, verbose_name=_("اسم السائق"))
    driver_phone = models.CharField(max_length=20, blank=True, null=True, verbose_name=_("رقم هاتف السائق"))
    vehicle = models.ForeignKey(
        'Vehicle',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("السيارة المستخدمة"),
        related_name='shipments'
    )
    shipment_type = models.CharField(
        max_length=20,
        default='delivery',
        verbose_name=_("نوع الرحلة")
    )
    butcher_names = models.TextField(
        blank=True,
        null=True,
        verbose_name=_("أسماء الجزارين")
    )
    route_plan = models.JSONField(
        default=list,
        blank=True,
        null=True,
        verbose_name=_("مسار الرحلة المرتب")
    )
    current_step_index = models.IntegerField(default=0, verbose_name=_("المحطة الحالية للسائق"))
    last_lat = models.CharField(max_length=50, blank=True, null=True, verbose_name=_("خط العرض (GPS)"))
    last_lng = models.CharField(max_length=50, blank=True, null=True, verbose_name=_("خط الطول (GPS)"))
    last_location_update = models.DateTimeField(null=True, blank=True, verbose_name=_("آخر تحديث للموقع"))
    history_log = models.JSONField(default=list, blank=True, null=True, verbose_name=_("سجل تحركات السائق"))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name=_("الحالة"))
    date = models.DateField(default=timezone.now, verbose_name=_("تاريخ الرحلة"))
    notes = models.TextField(blank=True, null=True, verbose_name=_("ملاحظات الرحلة"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = _("الرحلة")
        verbose_name_plural = _("الرحلات")

    def __str__(self):
        return f"رحلة #{self.id} - ({self.get_status_display()})"

class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', _('معلق (بانتظار الدفع)')),
        ('confirmed', _('مؤكد (جاهز للتجهيز)')),
        ('requires_action', _('يتطلب تدخل (نواقص) ⚠️')),
        ('processing', _('قيد التجهيز')),
        ('packaging', _('في الثلاجة/التغليف')),
        ('ready_for_shipment', _('جاهز للشحن')),
        ('out_for_delivery', _('في الطريق للتوصيل')),
        ('delivered', _('تم التوصيل')),
        ('completed', _('مكتمل')),
        ('canceled', _('ملغي')),
    ]

    DELIVERY_TYPE_CHOICES = [('delivery', _('توصيل للمنزل')), ('pickup', _('استلام من المزرعة'))]
    SOURCE_CHOICES = [('online_store', _('المتجر الإلكتروني')), ('on_farm', _('نقطة بيع مباشرة'))]
    PAYMENT_METHOD_CHOICES = [('cash', _('كاش')), ('card', _('بطاقة ائتمان/فيزا')), ('paymob', _('أونلاين'))]

    user = models.ForeignKey(
        CustomerUser,
        on_delete=models.CASCADE,
        related_name='orders',
        verbose_name=_("العميل")
    )
    created_by_employee = models.ForeignKey(
        'management.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("تم الإنشاء بواسطة (موظف)")
    )
    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='orders',
        verbose_name=_("الرحلة")
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name=_("الحالة"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("تاريخ الإنشاء"))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_("آخر تحديث"))
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_("السعر الإجمالي"))
    deposit_total = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_("المبلغ المدفوع"))
    service_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_("تكلفة الخدمات"))
    applied_discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0,
                                                  verbose_name=_("قيمة الخصم"))
    remaining_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name=_("المبلغ المتبقي"))
    delivery_type = models.CharField(max_length=20, choices=DELIVERY_TYPE_CHOICES, null=True, blank=True,
                                     verbose_name=_("نوع التوصيل"))
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='online_store',
                              verbose_name=_("مصدر الطلب"))
    pricing_model = models.CharField(max_length=20, default='care_fee', verbose_name=_("نظام التسعير المتبع"))
    delivery_date = models.DateField(null=True, blank=True, verbose_name=_("تاريخ التوصيل"))
    delivery_address = models.ForeignKey(
        Address,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("عنوان التوصيل")
    )
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, default='cash',
                                      verbose_name=_("طريقة الدفع"))
    has_slaughter_service = models.BooleanField(default=False, editable=False)
    notes = models.TextField(blank=True, null=True, verbose_name=_("ملاحظات"))
    signed_receipt_image = models.ImageField(upload_to='delivery_receipts/', null=True, blank=True,
                                             verbose_name=_("صورة الإيصال الممضي"))
    delivery_photo = models.ImageField(upload_to='delivery_photos/', null=True, blank=True,
                                       verbose_name=_("صورة التسليم (اختياري)"))
    is_paperwork_received = models.BooleanField(default=False,
                                                verbose_name=_("تم استلام الورق الأصلي من السائق"))
    delivery_otp = models.CharField(max_length=6, blank=True, null=True, verbose_name="كود التسليم (OTP)")
    arrival_sms_sent_at = models.DateTimeField(null=True, blank=True, verbose_name="وقت إرسال رسالة السائق")
    otp_sent_count = models.IntegerField(default=0, verbose_name="عدد مرات إرسال الـ OTP")
    discount_counted = models.BooleanField(default=False, editable=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._original_status = self.status

    def get_order_type_label(self):
        if self.source == 'on_farm':
            return 'نقطة بيع'
        for item in self.items.all():
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

    def recalc_totals(self, commit=True):
        if self.source == 'b2b':
            real_paid_amount = self.payments.filter(status='completed').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            self.deposit_total = real_paid_amount
            if self.business_source:
                self.total_price = self.business_source.quoted_total_price or self.total_price
            self.remaining_amount = self.total_price - self.deposit_total
            if self.status == 'pending' and real_paid_amount > 0:
                self.status = 'processing'
                if self.business_source:
                    b_req = self.business_source
                    b_req.status = 'paid'
                    b_req.save(update_fields=['status'])
            if commit:
                self.save()
            return self.total_price, self.deposit_total

        order_items = self.items.all()
        animal_total = Decimal('0.00')
        items_service_total = Decimal('0.00')
        total_discount = Decimal('0.00')
        has_slaughter = False

        for item in order_items:
            animal_total += item.price_per_item
            items_service_total += item.service_cost
            services = item.selected_services or {}
            if services.get('slaughter') or services.get('ذبح'):
                has_slaughter = True
            item_discount = Decimal(str(services.get('_discount_amount', '0.00')))
            total_discount += item_discount * item.share_quantity

        #   ( )   
        if self.user and self.user.is_discount_active and getattr(self.user, 'special_discount_type', 'percentage') == 'fixed':
            limit_valid = self.user.discount_max_animals == 0 or self.user.discount_used_animals < self.user.discount_max_animals
            now = timezone.now()
            date_valid = (not self.user.discount_start_date or now >= self.user.discount_start_date) and \
                         (not self.user.discount_end_date or now <= self.user.discount_end_date)
            if limit_valid and date_valid:
                voucher = Decimal(self.user.special_discount_amount or 0)
                if voucher > 0:
                    total_discount += voucher

        if total_discount == 0 and self.applied_discount_amount > 0 and self.status != 'pending':
            total_discount = self.applied_discount_amount

        delivery_fee = self.service_cost - items_service_total
        if delivery_fee < 0:
            delivery_fee = Decimal('0.00')

        self.service_cost = items_service_total + delivery_fee
        self.applied_discount_amount = total_discount
        self.total_price = (animal_total + self.service_cost) - total_discount

        if self.total_price < 0:
            self.total_price = Decimal('0.00')

        real_paid_amount = self.payments.filter(status='completed').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        self.deposit_total = real_paid_amount
        self.remaining_amount = self.total_price - self.deposit_total
        self.has_slaughter_service = has_slaughter

        if self.status == 'pending' and real_paid_amount > 0:
            self.status = 'confirmed'
        elif self.remaining_amount > 0 and self.status == 'completed':
            self.status = 'pending'

        if commit:
            self.save()
        return self.total_price, self.deposit_total

    @property
    def min_deposit_required(self):
        if self.source == 'b2b' and self.business_source:
            return self.business_source.quoted_deposit or Decimal('0.00')

        total_min = Decimal('0.00')
        items_service_total = Decimal('0.00')

        for item in self.items.all():
            services = item.selected_services or {}
            cat = item.animal.category

            has_slaughter = services.get('slaughter') or services.get('ذبح')

            min_pct = Decimal(str(getattr(cat, 'min_deposit_percentage', '0.20')))
            srv_pct = Decimal(str(getattr(cat, 'service_deposit_percentage', '0.50')))

            price = Decimal(str(item.price_per_item)) if item.price_per_item else Decimal('0.00')
            cost = Decimal(str(item.service_cost)) if item.service_cost else Decimal('0.00')
            qty = Decimal(str(item.share_quantity)) if item.share_quantity else Decimal('1.00')

            fixed_deposit = Decimal(str(item.animal.deposit_egp)) if item.animal.deposit_egp else Decimal('0.00')

            if fixed_deposit > 0:
                context = services.get('_order_context', '')
                is_full_sale = item.pipeline == 'M' or context in['general', 'adahi', 'adahi_full']

                if is_full_sale:
                    animal_deposit = fixed_deposit
                else:
                    max_shares = Decimal(str(getattr(cat, 'default_max_shares', 1)))
                    animal_deposit = (fixed_deposit / max_shares) * qty
            else:
                if cat and not getattr(cat, 'allow_deposit', True):
                    animal_deposit = price * qty
                else:
                    pct = srv_pct if has_slaughter else min_pct
                    animal_deposit = (price * pct * qty)

            item_deposit = animal_deposit + (cost * qty)
            total_min += item_deposit
            items_service_total += (cost * qty)

        delivery_fee = self.service_cost - items_service_total
        if delivery_fee > 0:
            total_min += delivery_fee

        total_order_price = Decimal(str(self.total_price)) if self.total_price else Decimal('0.00')

        if total_min > total_order_price:
            total_min = total_order_price

        return total_min.quantize(Decimal('0.01'))

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)

        if not is_new and self.status in['confirmed', 'processing', 'ready_for_shipment', 'out_for_delivery', 'delivered', 'completed'] and not self.discount_counted:
            self.discount_counted = True
            if self.user:
                used_special = False
                used_global = False

                for item in self.items.all():
                    services = item.selected_services or {}
                    source = services.get('_discount_source', 'none')
                    if source == 'user_special':
                        used_special = True
                    elif source == 'global':
                        used_global = True

                #    (     )
                if self.applied_discount_amount > 0 and self.user.is_discount_active and getattr(self.user, 'special_discount_type', 'percentage') == 'fixed':
                    used_special = True
                    self.user.voucher_used_in_order_id = str(self.id)
                    self.user.voucher_used_at = timezone.now()
                    self.user.is_discount_active = False

                    try:
                        from management.models import DiscountLog
                        DiscountLog.objects.create(
                            target_type='user',
                            target_user=self.user,
                            changed_by=self.created_by_employee,
                            old_percentage=0,
                            new_percentage=0,
                            notes=f"تم استهلاك قسيمة الخصم بقيمة {self.user.special_discount_amount} ج.م في طلب رقم #{self.id}"
                        )
                    except Exception as e:
                        pass

                if used_special:
                    self.user.discount_used_animals += 1
                elif used_global:
                    self.user.global_discount_used_animals += 1

                if self.user.is_discount_active and self.user.discount_max_animals > 0:
                    if self.user.discount_used_animals >= self.user.discount_max_animals:
                        self.user.is_discount_active = False

                self.user.save(update_fields=['discount_used_animals', 'global_discount_used_animals', 'is_discount_active', 'voucher_used_in_order_id', 'voucher_used_at'])
            if 'update_fields' in kwargs and 'discount_counted' not in kwargs['update_fields']:
                kwargs['update_fields'] = list(kwargs['update_fields']) + ['discount_counted']
            super().save(*args, **kwargs)

        elif not is_new and self.status == 'canceled' and self.discount_counted:
            self.discount_counted = False
            if self.user:
                used_special = False
                used_global = False

                for item in self.items.all():
                    services = item.selected_services or {}
                    source = services.get('_discount_source', 'none')
                    if source == 'user_special':
                        used_special = True
                    elif source == 'global':
                        used_global = True

                # ========   ========
                #         !
                if self.user.voucher_used_in_order_id == str(self.id):
                    used_special = True
                    self.user.voucher_used_in_order_id = None
                    self.user.voucher_used_at = None
                    self.user.is_discount_active = True

                    try:
                        from management.models import DiscountLog
                        DiscountLog.objects.create(
                            target_type='user',
                            target_user=self.user,
                            changed_by=self.created_by_employee,
                            old_percentage=0,
                            new_percentage=0,
                            notes=f"تم استرجاع قسيمة الخصم بسبب إلغاء الطلب رقم #{self.id}"
                        )
                    except Exception:
                        pass

                if used_special and self.user.discount_used_animals > 0:
                    self.user.discount_used_animals -= 1
                if self.user.discount_max_animals > 0 and self.user.discount_used_animals < self.user.discount_max_animals:
                    self.user.is_discount_active = True
                elif used_global and self.user.global_discount_used_animals > 0:
                    self.user.global_discount_used_animals -= 1
                self.user.save(update_fields=['discount_used_animals', 'global_discount_used_animals', 'voucher_used_in_order_id', 'voucher_used_at', 'is_discount_active'])

            super().save(update_fields=['discount_counted'])
            if 'update_fields' in kwargs and 'discount_counted' not in kwargs['update_fields']:
                kwargs['update_fields'] = list(kwargs['update_fields']) +['discount_counted']
            super().save(*args, **kwargs)

    @property
    def total_items_services(self):

        return sum((item.service_cost * item.share_quantity) for item in self.items.all())

    @property
    def delivery_fee(self):

        return max(Decimal('0.00'), self.service_cost - self.total_items_services)

    def __str__(self):
        return f"Order #{self.id} - {self.user}"

class BusinessRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', _('قيد المراجعة')
        QUOTED = 'quoted', _('تم التسعير (بانتظار الدفع)')
        PAID = 'paid', _('تم الدفع (بانتظار التخصيص)')
        FULFILLED = 'fulfilled', _('تم التنفيذ (تحول لطلب)')
        REJECTED = 'rejected', _('مرفوض')

    user = models.ForeignKey(
        CustomerUser,
        on_delete=models.CASCADE,
        related_name='business_requests',
        verbose_name=_("العميل")
    )
    request_details = models.JSONField(
        verbose_name=_("تفاصيل الطلبية"),
        help_text=_("قائمة تحتوي على العناصر المطلوبة")
    )
    customer_notes = models.TextField(blank=True, null=True, verbose_name=_("ملاحظات العميل"))
    admin_notes = models.TextField(blank=True, null=True, verbose_name=_("ملاحظات الإدارة"))
    quoted_total_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_("السعر المقترح")
    )
    quoted_deposit = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_("العربون المطلوب")
    )
    expected_delivery_date = models.DateField(null=True, blank=True, verbose_name=_("تاريخ التوصيل المتوقع"))
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, verbose_name=_("الحالة"))
    converted_order = models.OneToOneField(
        'Order',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='business_source',
        verbose_name=_("الطلب المحول")
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name=_("تم الإنشاء بواسطة"),
        related_name='created_business_requests'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"طلب شركات #{self.id} ({self.get_status_display()})"

    def clean(self):
        from django.core.exceptions import ValidationError
        if not isinstance(self.request_details, list) or not self.request_details:
            raise ValidationError(_("تفاصيل الطلب يجب أن تكون قائمة غير فارغة"))
        operation_settings = OperationSettings.load()
        min_quantity = operation_settings.min_business_order_quantity
        total_items = sum(int(item.get('quantity') or 0) for item in self.request_details)
        if total_items < min_quantity:
            raise ValidationError(_(f"الحد الأدنى لطلبات الشركات هو {min_quantity} رأس."))

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    @property
    def total_quantity(self):
        return sum(int(item.get('quantity') or 0) for item in self.request_details)

class OrderItem(models.Model):
    class OffalPreference(models.TextChoices):
        RECEIVE = 'receive', _('استلام (مع اللحم)')
        DONATE = 'donate', _('تبرع (للمحتاجين)')
        SELL = 'sell', _('بيع (خصم من الثمن) - غير متاح للأضحية')

    PIPELINE_CHOICES = [
        ('M', 'M - سوق المواشي'),
        ('S', 'S - الأضاحي'),
        ('G', 'G - تشارك عام'),
    ]

    request_slaughter_video = models.BooleanField(default=False, verbose_name=_("طلب تصوير الذبح"))
    from django.core.validators import FileExtensionValidator
    slaughter_video = models.FileField(upload_to='slaughter_videos/', blank=True, null=True, verbose_name=_("فيديو الذبح للعميل"), validators=[FileExtensionValidator(allowed_extensions=['mp4', 'mov', 'avi', 'mkv'])])
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, verbose_name=_("الحيوان"))
    pipeline = models.CharField(max_length=1, choices=PIPELINE_CHOICES, default='M', verbose_name=_("الماسورة"))
    price_per_item = models.DecimalField(max_digits=10, decimal_places=2, verbose_name=_("السعر للقطعة"))
    deposit_per_item = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name=_("عربون للقطعة"))
    service_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                       help_text=_("التكلفة الإجمالية للخدمات"))
    selected_services = models.JSONField(default=dict, blank=True, help_text=_("الخدمات المختارة"))
    share_quantity = models.PositiveIntegerField(default=1, verbose_name=_("كمية المشاركة"))
    listing_section = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name=_("قسم الإدراج داخل الماسورة"),
        help_text=_("مثال: full_sale, adahi_pool, adahi_full, adahi_group, shares")
    )
    extra_parts_preference = models.CharField(
        max_length=20,
        choices=OffalPreference.choices,
        default=OffalPreference.RECEIVE,
        verbose_name=_("مصير الأجزاء الإضافية (الرأس/السقط)"),
        help_text=_("لأضاحي التشارك: استلام أو تبرع فقط (توزيع بالقرعة). للتشارك العادي: متاح البيع.")
    )
    original_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True,
                                         verbose_name=_("السعر المبدئي وقت الحجز"))
    original_weight = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True,
                                          verbose_name=_("الوزن التقديري وقت الحجز"))
    actual_weight = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True,
                                        verbose_name=_("الوزن الفعلي وقت التسليم"))

    class Meta:
        verbose_name = _("عنصر الطلب")
        verbose_name_plural = _("عناصر الطلب")

    def __str__(self):
        return f"{self.animal.code} - {self.pipeline} في الطلب {self.order.id}"

    def get_total_price(self):
        return (self.price_per_item or Decimal('0.00')) + self.service_cost

    def get_total_deposit(self):
        return self.deposit_per_item or Decimal('0.00')

    def save(self, *args, **kwargs):
        if not self.listing_section and self.selected_services:
            context = self.selected_services.get('_order_context', '')
            if self.pipeline == 'M':
                self.listing_section = 'full_sale'
            elif self.pipeline == 'S':
                if context == 'adahi_pool':
                    self.listing_section = 'adahi_pool'
                elif context == 'adahi_group':
                    self.listing_section = 'adahi_group'
                else:
                    self.listing_section = 'adahi_full'
            elif self.pipeline == 'G':
                self.listing_section = 'shares'

        if not self.original_price and self.price_per_item:
            self.original_price = self.price_per_item

        if not self.original_weight and self.animal:
            self.original_weight = self.animal.current_weight or Decimal('0.00')

        super().save(*args, **kwargs)

class SpecialRequest(models.Model):
    class RequestStatus(models.TextChoices):
        PENDING = 'pending', _('قيد البحث')
        SOURCED = 'sourced', _('تم العثور عليها')
        CONFIRMED = 'confirmed', _('مؤكد من العميل')
        COMPLETED = 'completed', _('مكتمل')
        CANCELLED = 'cancelled', _('ملغي')

    user = models.ForeignKey(CustomerUser, on_delete=models.CASCADE, related_name='special_requests',
                             verbose_name=_("العميل"))
    requested_specs = models.JSONField(default=dict, verbose_name=_("المواصفات المطلوبة"))
    status = models.CharField(max_length=20, choices=RequestStatus.choices, default=RequestStatus.PENDING,
                              verbose_name=_("الحالة"))
    notes = models.TextField(blank=True, null=True, verbose_name=_("ملاحظات"))
    sourced_animal = models.ForeignKey(Animal, on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
                                       verbose_name=_("الحيوان الذي تم العثور عليه"))
    related_order = models.OneToOneField(Order, on_delete=models.SET_NULL, null=True, blank=True,
                                         related_name='from_special_request')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = _("طلب خاص")
        verbose_name_plural = _("الطلبات الخاصة")
        ordering = ['-created_at']

    def __str__(self):
        return f"طلب خاص لـ {self.user} - {self.get_status_display()}"

class Vehicle(models.Model):
    TYPE_CHOICES = [
        ('livestock', _('نقل مواشي (حية)')),
        ('refrigerated', _('مبردة (لحوم)')),
        ('general', _('نقل عام/إداري'))
    ]

    OWNERSHIP_CHOICES = [
        ('owned', _('مملوكة للمزرعة')),
        ('rented', _('إيجار'))
    ]

    name = models.CharField(max_length=100, verbose_name=_("اسم/وصف السيارة"), help_text="مثال: شيفروليه جامبو أبيض")
    plate_number = models.CharField(max_length=20, unique=True, verbose_name=_("رقم اللوحة"))
    vehicle_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='livestock',
                                    verbose_name=_("نوع السيارة"))
    ownership = models.CharField(max_length=20, choices=OWNERSHIP_CHOICES, default='owned', verbose_name=_("الملكية"))
    capacity_description = models.CharField(max_length=255, blank=True, verbose_name=_("وصف الحمولة"))
    driver_name = models.CharField(max_length=100, blank=True, null=True, verbose_name=_("السائق الافتراضي"))
    driver_phone = models.CharField(max_length=20, blank=True, null=True, verbose_name=_("رقم هاتف السائق"))
    is_active = models.BooleanField(default=True, verbose_name=_("متاحة للعمل"))
    notes = models.TextField(blank=True, verbose_name=_("ملاحظات"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("مركبة/سيارة")
        verbose_name_plural = _("أسطول السيارات")

    def __str__(self):
        return f"{self.name} ({self.plate_number})"

