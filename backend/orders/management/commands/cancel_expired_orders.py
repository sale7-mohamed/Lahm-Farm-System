from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
from orders.models import Order, BusinessRequest
from livestock.models import AnimalListing, AdahiGroup
from notifications.utils import send_notification

class Command(BaseCommand):
    help = 'Cancels pending orders (15 mins for B2C, 48 hours for B2B) and restores inventory'

    def handle(self, *args, **options):
        b2c_threshold = timezone.now() - timedelta(minutes=15)
        b2b_threshold = timezone.now() - timedelta(hours=48)

        expired_orders = Order.objects.filter(status='pending').filter(
            Q(source__in=['online_store', 'on_farm'], created_at__lt=b2c_threshold) |
            Q(source='b2b', created_at__lt=b2b_threshold)
        )

        order_count = 0
        for order in expired_orders:
            with transaction.atomic():
                order = Order.objects.select_for_update().get(pk=order.pk)
                order.status = 'canceled'

                cancel_reason = '48 hours' if order.source == 'b2b' else '15 minutes'
                order.notes = (order.notes or '') + f'\n[System]: Automatically cancelled due to non-payment within {cancel_reason}.'
                order.save(update_fields=['status', 'notes'])

                if order.user:
                    today = timezone.now().date()
                    canceled_unpaid_today = Order.objects.filter(
                        user=order.user,
                        updated_at__date=today,
                        status='canceled',
                        deposit_total=0
                    ).count()

                    remaining = max(0, 3 - canceled_unpaid_today)

                    title = f"تم إلغاء طلبك #{order.id}"
                    if remaining > 0:
                        msg = (f"تم إلغاء طلبك رقم #{order.id}    . "
                               f"تنبيه: لقد تم إلغاء {canceled_unpaid_today} طلبات لك اليوم، "
                               f"يتبقى لك {remaining} محاولات اليوم لعمل طلبات جديدة.")
                    else:
                        msg = (f"تم إلغاء طلبك رقم #{order.id}    . "
                               f"نظراً لتكرار الطلبات غير المدفوعة، تم تقييد حسابك من عمل طلبات جديدة اليوم. "
                               f"")

                    send_notification(user=order.user, title=title, message=msg, category='order')

                if order.source == 'b2b' and hasattr(order, 'business_source'):
                    b2b_req = order.business_source
                    if b2b_req:
                        b2b_req.status = 'rejected'
                        b2b_req.admin_notes = (b2b_req.admin_notes or '') + '\n[System]: Order automatically cancelled – deposit not paid within 48 hours.'
                        b2b_req.save(update_fields=['status', 'admin_notes'])

                for item in order.items.select_related('animal').all():
                    animal = item.animal
                    services = item.selected_services or {}

                    if services.get('is_group_creator') and item.listing_section == 'adahi_group':
                        AdahiGroup.objects.filter(listing__animal=animal, created_by=order.user).delete()
                        AnimalListing.objects.filter(animal=animal, section='adahi_group').update(is_active=False)

                    elif item.listing_section:
                        listing = AnimalListing.objects.select_for_update().filter(
                            animal=animal,
                            pipeline=item.pipeline,
                            section=item.listing_section
                        ).first()
                        if listing:
                            listing.available_shares += item.share_quantity
                            listing.is_active = True
                            listing.save(update_fields=['available_shares', 'is_active'])

                    if not animal.has_partial_sales():
                        animal.status = 'available'
                        animal.first_sale_at = None
                        animal.save(update_fields=['status', 'first_sale_at'])

                        paused_listings = AnimalListing.objects.filter(animal=animal, paused_due_to_order=True)
                        for pl in paused_listings:
                            pl.is_active = True
                            pl.paused_due_to_order = False
                            if pl.available_shares == 0:
                                pl.available_shares = pl.total_shares
                            pl.save(update_fields=['is_active', 'paused_due_to_order', 'available_shares'])

                order_count += 1
                self.stdout.write(f'Cancelled Order #{order.id} (Source: {order.source}) – inventory restored.')

        expired_b2b_requests = BusinessRequest.objects.filter(
            status='quoted',
            updated_at__lt=b2b_threshold
        )
        b2b_request_count = 0
        for req in expired_b2b_requests:
            req.status = 'rejected'
            req.admin_notes = (req.admin_notes or '') + '\n[System]: Automatically cancelled – no action/payment within 48 hours.'
            req.save(update_fields=['status', 'admin_notes'])
            b2b_request_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Successfully cancelled {order_count} expired orders and {b2b_request_count} business requests.'
        ))