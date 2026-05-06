from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Reservation
from livestock.models import Animal

try:
    from notifications.utils import send_notification, send_admin_notification
except ImportError:
    send_notification = None
    send_admin_notification = None

@receiver(post_save, sender=Reservation)
def set_animal_reserved(sender, instance, created, **kwargs):
    animal = instance.animal

    #    pending →      
    if created and instance.status == 'pending':
        if animal.status == 'available':
            animal.status = 'reserved'
            animal.save()

        if send_admin_notification:
            send_admin_notification(
                title="حجز جديد",
                message=f"تم إنشاء حجز جديد على الحيوان {animal.code} بواسطة {instance.user.username}.",
                category="reservation"
            )

    #     confirmed →  
    elif not created and instance.status == 'confirmed' and send_notification:
        send_notification(
            instance.user,
            title="تم تأكيد الحجز",
            message=f"تم تأكيد الحجز الخاص بك على الحيوان {animal.code}.",
            category="reservation"
        )

@receiver(post_delete, sender=Reservation)
def set_animal_available(sender, instance, **kwargs):
    animal = instance.animal
    if animal.status == 'reserved':
        animal.status = 'available'
        animal.save()

