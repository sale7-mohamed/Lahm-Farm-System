# cart/models.py
from decimal import Decimal
from django.db import models
from django.conf import settings
from livestock.models import Animal

User = 'accounts.User'

class Cart(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='cart')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cart of {self.user}"

    def total_price(self):
        return sum((item.total_price() for item in self.items.all()), Decimal('0.00'))

    def deposit_total(self):
        return sum((item.deposit_total() for item in self.items.all()), Decimal('0.00'))

    def total_items(self):
        return self.items.count()

class CartItem(models.Model):
    PIPELINE_CHOICES = [
        ('M', 'M'),
        ('S', 'S'),
        ('G', 'G'),
    ]

    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE)
    pipeline = models.CharField(max_length=1, choices=PIPELINE_CHOICES, default='M', help_text="الماسورة التي تم الشراء منها")
    price_per_item = models.DecimalField(max_digits=10, decimal_places=2)
    selected_services = models.JSONField(default=dict, blank=True, null=True, help_text="خيارات الخدمات التي اختارها المستخدم لهذا العنصر")
    share_quantity = models.PositiveIntegerField(default=1, help_text="عدد الأسهم المطلوبة إذا كان الحيوان قابلاً للمشاركة")

    class Meta:
        unique_together = ('cart', 'animal', 'pipeline')

    def save(self, *args, **kwargs):
        if not self.price_per_item or self.price_per_item <= 0:
            self.price_per_item = self.animal.price_egp or Decimal('0.00')
        super().save(*args, **kwargs)

    def total_price(self):
        return self.price_per_item or Decimal('0.00')

    def deposit_total(self):
        dep = getattr(self.animal, 'deposit_egp', None)
        if dep is None:
            dep = Decimal('0.00')
        return dep

    def __str__(self):
        return f"{self.animal.code} - {self.pipeline}"
