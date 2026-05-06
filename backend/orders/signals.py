import logging
import random
import string
from django.db import models, transaction
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone

from .models import OrderItem, Order, Shipment
from livestock.models import AdahiGroup, AnimalListing
from notifications.utils import send_notification
from messaging.services import MessagingService

logger = logging.getLogger(__name__)

def _recalc_order(order):
    if not order or not getattr(order, 'pk', None):
        return
    try:
        with transaction.atomic():
            order.recalc_totals(commit=True)
    except Exception as e:
        logger.error(f"Error recalculating order {order.pk}: {e}")

@receiver(post_save, sender=OrderItem)
def order_item_saved(sender, instance, created, **kwargs):
    if instance.order:
        _recalc_order(instance.order)

@receiver(post_delete, sender=OrderItem)
def order_item_deleted(sender, instance, **kwargs):
    if instance.order:
        _recalc_order(instance.order)

@receiver(post_save, sender=OrderItem)
def handle_sale_across_listings(sender, instance, created, **kwargs):
    if not created or instance.order.status == 'canceled':
        return

    animal = instance.animal
    pipeline = instance.pipeline
    share_quantity = instance.share_quantity

    with transaction.atomic():
        section = None
        if pipeline == 'M':
            section = 'full_sale'
        elif pipeline == 'S':
            services = instance.selected_services or {}
            context = services.get('_order_context', '')
            if context == 'adahi_pool':
                section = 'adahi_pool'
            elif context == 'adahi_group':
                section = 'adahi_group'
            else:
                section = 'adahi_full'
        elif pipeline == 'G':
            section = 'shares'

        if not section:
            return

        listing = AnimalListing.objects.filter(
            animal=animal,
            pipeline=pipeline,
            section=section,
            is_active=True
        ).select_for_update().first()

        if not listing:
            return

        if not animal.first_sale_at:
            animal.first_sale_at = timezone.now()
            animal.save(update_fields=['first_sale_at'])

        active_other_listings = AnimalListing.objects.filter(
            animal=animal, is_active=True
        ).exclude(id=listing.id)
        active_other_listings.update(is_active=False, paused_due_to_order=True)

        if not listing.is_active:
            listing.is_active = True
            listing.save(update_fields=['is_active'])

        if share_quantity > 0:
            try:
                listing.decrement_shares(share_quantity)
            except ValueError as e:
                logger.error(f"Error decrementing shares: {e}")
                return

        if listing.available_shares <= 0:
            listing.is_active = False
            listing.save(update_fields=['is_active'])

            total_available = AnimalListing.objects.filter(
                animal=animal,
                is_active=True
            ).aggregate(total=models.Sum('available_shares'))['total'] or 0

            if total_available <= 0:
                animal.status = 'sold'
                animal.save(update_fields=['status'])

@receiver(post_save, sender=Order)
def notify_order_status_change(sender, instance, created, **kwargs):
    if created or not instance.user or not instance.user.phone:
        return

    original_status = getattr(instance, '_original_status', None)
    if original_status == instance.status:
        return

    instance._original_status = instance.status

    if instance.status in['confirmed', 'processing']:
        for item in instance.items.all():
            AnimalListing.objects.filter(
                animal=item.animal,
                paused_due_to_order=True
            ).update(paused_due_to_order=False)

    template_key = None
    if instance.status == 'confirmed':
        template_key = 'ORDER_CONFIRMED'
    elif instance.status == 'delivered':
        template_key = 'ORDER_DELIVERED'

    if template_key:
        try:
            context = {
                'name': instance.user.full_name or '',
                'id': instance.id,
                'total': instance.total_price or 0
            }
            MessagingService.send_template_message(
                instance.user.phone,
                template_key,
                context
            )
        except Exception as e:
            logger.error(f"Error sending notification for order {instance.id}: {e}")

@receiver(post_save, sender=Shipment)
def notify_shipment_start(sender, instance, created, **kwargs):
    if instance.status != 'out_for_delivery':
        return

    for order in instance.orders.all():
        if not order.user or not order.user.phone:
            continue

        try:
            context = {
                'name': order.user.full_name or '',
                'id': order.id
            }
            MessagingService.send_template_message(
                order.user.phone,
                'ORDER_SHIPPED',
                context
            )
        except Exception as e:
            logger.error(f"Error shipping notification for order {order.id}: {e}")

@receiver(post_save, sender=Order)
def handle_adahi_group_creation(sender, instance, created, **kwargs):
    valid_completed_statuses = [
        'confirmed', 'processing', 'ready_for_shipment',
        'shipped', 'delivered', 'completed'
    ]

    for item in instance.items.all():
        services = item.selected_services or {}
        is_group_creator = services.get('is_group_creator', False)
        context = services.get('_order_context', '')

        if context == 'adahi_group':
            try:
                animal = item.animal
                listing = AnimalListing.objects.filter(
                    animal=animal,
                    pipeline='S',
                    section='adahi_group'
                ).first()

                if not listing:
                    continue

                with transaction.atomic():
                    try:
                        group = listing.adahi_group
                    except AdahiGroup.DoesNotExist:
                        group = None

                    if is_group_creator and not group:
                        group_code = ''.join(
                            random.choices(string.ascii_uppercase + string.digits, k=6)
                        )
                        listing.group_code = group_code
                        listing.group_creator = instance.user
                        listing.group_expires_at = timezone.now() + timezone.timedelta(hours=24)
                        listing.save()

                        group = AdahiGroup.objects.create(
                            listing=listing,
                            code=group_code,
                            created_by=instance.user,
                            is_active=False,
                            expires_at=listing.group_expires_at
                        )

                    if group and instance.status in valid_completed_statuses and not group.is_active:
                        group.is_active = True
                        group.save()

                        if group.created_by:
                            send_notification(
                                group.created_by,
                                title="تم تفعيل مجموعتك بنجاح",
                                message=f"كود المجموعة الخاص بك هو: {group.code} ، انسخ الكود وشاركه مع أقاربك.",
                                category="livestock"
                            )

                            if group.created_by.phone:
                                msg = f"تم تفعيل مجموعتك الخاصة بنجاح! كود المجموعة: {group.code}"
                                MessagingService.send_message(
                                    group.created_by.phone,
                                    msg,
                                    'AUTOMATED'
                                )
            except Exception as e:
                logger.error(f"Error handling Adahi Group for animal {item.animal.pk}: {e}")

@receiver(post_save, sender=Order)
def cleanup_unpaid_group_on_cancel(sender, instance, **kwargs):
    if instance.status == 'canceled':
        for item in instance.items.all():
            services = item.selected_services or {}
            if services.get('is_group_creator', False) and services.get('_order_context', '') == 'adahi_group':
                try:
                    listing = AnimalListing.objects.filter(
                        animal=item.animal,
                        pipeline='S',
                        section='adahi_group'
                    ).first()
                    if listing and hasattr(listing, 'adahi_group'):
                        group = listing.adahi_group
                        if group.created_by == instance.user and not group.is_active:
                            group.delete()
                            listing.is_active = False
                            listing.save()
                except Exception as e:
                    logger.error(f"Error deleting unpaid group for canceled order {instance.id}: {e}")

