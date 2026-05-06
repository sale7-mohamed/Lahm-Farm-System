from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db import transaction
from django.utils import timezone
from django.db import models
from .models import Animal, AnimalListing
from orders.models import OrderItem

@receiver(post_save, sender=Animal)
def manage_animal_listings(sender, instance, created, **kwargs):

    #  : 'sold'  'lost'
    if instance.status in ['sold', 'lost']:
        AnimalListing.objects.filter(animal=instance).update(is_active=False)
        return

    if instance.is_hidden_from_store:
        AnimalListing.objects.filter(animal=instance).update(is_active=False)
        return

    AnimalListing.objects.filter(animal=instance, is_active=True).update(price=instance.price_after_discount)

    #  :       (S)
    if instance.has_defect:

        AnimalListing.objects.filter(
            animal=instance,
            pipeline='S'
        ).update(is_active=False)

    with transaction.atomic():
        # 1.   (M) -     
        if instance.status == 'available' and not instance.is_hidden_from_store:
            listing_m, _ = AnimalListing.objects.get_or_create(
                animal=instance,
                pipeline='M',
                section='full_sale',
                defaults={
                    'price': instance.price_after_discount,
                    'total_shares': 1,
                    'available_shares': 1,
                    'is_active': True
                }
            )

            if not listing_m.is_active and not instance.has_partial_sales():
                listing_m.is_active = True
                if listing_m.available_shares <= 0:
                    listing_m.available_shares = listing_m.total_shares
                listing_m.save()

        # 2.   (S) -      
        if (instance.status == 'available' and
            instance.is_sacrifice_valid_now and
            not instance.has_defect):

            listing_full, _ = AnimalListing.objects.get_or_create(
                animal=instance,
                pipeline='S',
                section='adahi_full',
                defaults={
                    'price': instance.price_after_discount,
                    'total_shares': 1,
                    'available_shares': 1,
                    'is_active': True
                }
            )
            if not listing_full.is_active and not instance.has_partial_sales():
                listing_full.is_active = True
                if listing_full.available_shares <= 0:
                    listing_full.available_shares = listing_full.total_shares
                listing_full.save()

            # 3.   (G) 
            listing_group, _ = AnimalListing.objects.get_or_create(
                animal=instance,
                pipeline='S',
                section='adahi_group',
                defaults={
                    'price': instance.price_after_discount,
                    'total_shares': 7 if instance.category and instance.category.logic_type in ['cow', 'camel'] else 1,
                    'available_shares': 7 if instance.category and instance.category.logic_type in ['cow', 'camel'] else 1,
                    'is_active': False
                }
            )

