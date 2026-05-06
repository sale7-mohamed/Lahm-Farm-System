# D:\pro\life\notifications\models.py

from django.db import models
from django.conf import settings

class Notification(models.Model):
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='notifications'
        # user_id  NOT NULL        user

        # null=True, blank=True
        #    makemigrations  migrate
    )
    title = models.CharField(max_length=255, default="إشعار")
    message = models.TextField()
    category = models.CharField(
        max_length=50,
        choices=[
            ('order', 'Order'),
            ('payment', 'Payment'),
            ('cart', 'Cart'),
            ('livestock', 'Livestock'),
            ('reservation', 'Reservation'),
            ('general', 'General'),
        ],
        default='general'
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notification for {self.user}: {self.title[:20]}"
