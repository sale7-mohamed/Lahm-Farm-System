from django.db import models
from orders.models import Order
from accounts.models import User as CustomerUser

class Payment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]

    PAYMENT_TYPE_CHOICES = [
        ('initial', 'دفعة أولى/عربون'),
        ('remainder', 'باقي المبلغ'),
    ]

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='payments')
    user = models.ForeignKey(CustomerUser, on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=50)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE_CHOICES, default='initial')
    transaction_id = models.CharField(max_length=255, blank=True, null=True)
    recorded_by = models.ForeignKey('management.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_payments')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Payment {self.id} for Order {self.order.id} - {self.status}'

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['order', 'status']),
            models.Index(fields=['user', 'created_at']),
        ]
