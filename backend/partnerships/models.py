# partnerships/models.py
from django.db import models
from django.utils.translation import gettext_lazy as _

class PartnershipApplication(models.Model):
    TYPE_CHOICES = [
        ('farm', _('مزرعة (مورد)')),
        ('business', _('نشاط تجاري (مطعم/فندق/جزارة)')),
    ]

    STATUS_CHOICES = [
        ('pending', _('قيد المراجعة')),
        ('contacted', _('تم التواصل')),
        ('approved', _('تمت الموافقة')),
        ('rejected', _('مرفوض')),
    ]

    application_type = models.CharField(max_length=20, choices=TYPE_CHOICES, verbose_name=_("نوع الطلب"))
    name = models.CharField(max_length=255, verbose_name=_("اسم الجهة/الشخص"))
    phone = models.CharField(max_length=20, verbose_name=_("رقم الهاتف"))
    email = models.EmailField(blank=True, null=True, verbose_name=_("البريد الإلكتروني"))
    address = models.CharField(max_length=255, verbose_name=_("العنوان/المنطقة"))
    details = models.TextField(verbose_name=_("تفاصيل العرض/الطلب"), help_text=_("للمزارع: عدد ونوع المواشي. للمطاعم: الكميات المتوقعة."))

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name=_("الحالة"))
    admin_notes = models.TextField(blank=True, null=True, verbose_name=_("ملاحظات الإدارة"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = _("طلب شراكة")
        verbose_name_plural = _("طلبات الشراكة")

    def __str__(self):
        return f"{self.get_application_type_display()} - {self.name}"
