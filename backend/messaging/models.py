# messaging/models.py
from django.db import models
from django.utils.translation import gettext_lazy as _

class MessageTemplate(models.Model):
    """
          .
    : 'ORDER_SHIPPED' -> ' {name}   {id}   .'
    """
    KEY_CHOICES = [
        ('OTP', 'رمز التحقق (OTP)'),
        ('ORDER_CONFIRMED', 'تأكيد الطلب'),
        ('ORDER_SHIPPED', 'الطلب خرج للتوصيل'),
        ('ORDER_DELIVERED', 'تم تسليم الطلب'),
        ('DRIVER_NEAR', 'السائق بالقرب منك'),
    ]

    key = models.CharField(max_length=50, choices=KEY_CHOICES, unique=True, verbose_name=_("نوع الرسالة"))
    content = models.TextField(verbose_name=_("نص الرسالة"), help_text=_("استخدم الأقواس {} للمتغيرات. مثال: {name}"))
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.get_key_display()

class MessageLog(models.Model):
    """
          .
    """
    TYPE_CHOICES = [
        ('OTP', 'OTP'),
        ('AUTOMATED', 'تلقائي (نظام)'),
        ('MANUAL', 'يدوي (أدمن)'),
        ('EMAIL', 'بريد إلكتروني'),
    ]
    STATUS_CHOICES = [
        ('sent', 'تم الإرسال'),
        ('failed', 'فشل'),
    ]

    recipient = models.CharField(max_length=255, verbose_name=_("المستلم"))
    content = models.TextField(verbose_name=_("نص الرسالة"))
    message_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    provider_response = models.TextField(blank=True, null=True, verbose_name=_("رد المزود"))
    created_at = models.DateTimeField(auto_now_add=True)
    sent_by = models.ForeignKey('management.Employee', on_delete=models.SET_NULL, null=True, blank=True, verbose_name=_("مرسلة بواسطة"))

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.recipient} - {self.message_type}"

