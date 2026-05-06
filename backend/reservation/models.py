# D:\pro\life\reservation\models.py

from django.db import models
from django.utils import timezone
from livestock.models import Animal, DeliveryArea, ClientServiceOption, DeliverySetting, ServicePriceSetting
from datetime import date, timedelta
from decimal import Decimal
from accounts.models import User as CustomerUser

class Reservation(models.Model):
    STATUS_CHOICES = [
        ('pending', 'في انتظار الدفع'),
        ('confirmed', 'تم تأكيد الحجز'),
        ('cancelled', 'تم الإلغاء'),
        ('completed', 'تم التسليم والانتهاء'),
    ]

    BOOKING_TYPE_CHOICES = [
        ('deposit', 'دفع عربون'),
        ('full', 'دفع كامل'),
    ]

    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name='reservations')
    user = models.ForeignKey(CustomerUser, on_delete=models.CASCADE, related_name='reservations')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    reserved_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(blank=True, null=True, help_text="تاريخ انتهاء صلاحية العربون أو الحجز إذا لم يتم الدفع الكامل")

    paid_amount_on_booking = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="المبلغ المدفوع عند الحجز (عربون أو كامل)")
    total_calculated_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="السعر الإجمالي المحسوب للحجز بكل الخدمات والرسوم")
    remaining_amount_due = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="المبلغ المتبقي المطلوب دفعه")

    booking_type = models.CharField(max_length=10, choices=BOOKING_TYPE_CHOICES, default='deposit')
    delivery_option_type = models.CharField(max_length=20, blank=True, null=True, help_text="to_home, pickup")
    slaughter_option_type = models.CharField(max_length=20, blank=True, null=True, help_text="live, slaughtered")
    cutting_option = models.CharField(max_length=10, blank=True, null=True, help_text="yes, no")
    packaging_option = models.CharField(max_length=10, blank=True, null=True, help_text="yes, no")
    butcher_notes = models.TextField(blank=True, null=True)
    delivery_area = models.ForeignKey(DeliveryArea, on_delete=models.SET_NULL, null=True, blank=True, related_name='reservations_for_area')
    client_services_options_ids = models.JSONField(default=list, blank=True, null=True, help_text="قائمة بـ IDs الخدمات الإضافية التي تم اختيارها")

    requested_delivery_date = models.DateField(blank=True, null=True)
    booking_start_date = models.DateField(blank=True, null=True)
    extended_duration_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    share_quantity = models.PositiveIntegerField(default=1, verbose_name="عدد الأسهم")

    class Meta:
        ordering = ['-reserved_at']

    def __str__(self):
        return f"حجز {self.animal.code} - {self.user.username} ({self.status}) - {self.total_calculated_price:.2f} EGP"

    @property
    def duration_in_days(self):
        if self.booking_start_date and self.requested_delivery_date:
            return (self.requested_delivery_date - self.booking_start_date).days
        return 0

    def calculate_prices(self,
                         min_deposit_percentage,
                         standard_free_booking_days,
                         slaughter_price=Decimal(0),
                         cutting_price=Decimal(0),
                         packaging_price=Decimal(0),
                         extended_duration_per_day_price=Decimal(0),
                         client_service_options_prices=None):

        if client_service_options_prices is None:
            client_service_options_prices = []

        base_price = Decimal(self.animal.price_egp)

        if self.animal.is_shareable and self.animal.max_shares > 1:
            price_per_share = base_price / Decimal(self.animal.max_shares)
            base_price = price_per_share * Decimal(self.share_quantity)

        if self.animal.is_offer and self.animal.discount_percent > 0:
            base_price = base_price * (Decimal(1) - (self.animal.discount_percent / Decimal(100)))

        total = base_price

        if self.slaughter_option_type == 'slaughtered' or self.delivery_option_type == 'to_home':
            total += Decimal(slaughter_price)

        if self.cutting_option == 'yes':
            total += Decimal(cutting_price)

        if self.packaging_option == 'yes':
            total += Decimal(packaging_price)

        if self.delivery_option_type == 'to_home' and self.delivery_area:
            total += Decimal(self.delivery_area.delivery_price)

        for price in client_service_options_prices:
            total += Decimal(price)

        extended_cost = Decimal(0)
        if self.duration_in_days > standard_free_booking_days and extended_duration_per_day_price > 0:
            extra_days = self.duration_in_days - standard_free_booking_days
            extended_cost = Decimal(extra_days) * Decimal(extended_duration_per_day_price)
            total += extended_cost

        self.extended_duration_cost = extended_cost
        self.total_calculated_price = total

        if self.booking_type == 'full':
            self.paid_amount_on_booking = self.total_calculated_price
            self.remaining_amount_due = Decimal(0)
        elif self.booking_type == 'deposit':
            if hasattr(self.animal, 'category') and not self.animal.category.allow_deposit:
                min_deposit_amount = self.total_calculated_price
            else:
                min_deposit_amount = self.total_calculated_price * Decimal(min_deposit_percentage)

            if self.paid_amount_on_booking < 0:
                self.paid_amount_on_booking = Decimal(0)

            self.remaining_amount_due = self.total_calculated_price - self.paid_amount_on_booking
            if self.remaining_amount_due < 0:
                 self.remaining_amount_due = Decimal(0)

