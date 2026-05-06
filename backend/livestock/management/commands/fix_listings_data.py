from django.core.management.base import BaseCommand
from django.db.models import Sum
from livestock.models import Animal, AnimalListing
from orders.models import OrderItem

class Command(BaseCommand):
    help = 'Fixes AnimalListing logic and resets corrupted shares gracefully'

    def handle(self, *args, **options):
        self.stdout.write("Starting smart fix process...")
        animals = Animal.objects.all()
        fixed_count = 0

        for animal in animals:

            sold_items = OrderItem.objects.filter(
                animal=animal,
                order__status__in=['pending', 'confirmed', 'processing', 'ready_for_shipment', 'shipped', 'delivered', 'completed']
            )

            listings = AnimalListing.objects.filter(animal=animal)

            if not sold_items.exists():
                for listing in listings:
                    listing.available_shares = listing.total_shares

                    if listing.section in ['full_sale', 'adahi_full'] and animal.status == 'available' and not animal.is_hidden_from_store:
                        listing.is_active = True
                    else:

                        listing.is_active = getattr(listing, 'is_active', False)
                    listing.save()

                if animal.status not in ['available', 'lost']:
                    animal.status = 'available'
                    animal.lock_type = 'none'
                    animal.save()
                continue

            #  :     (  )
            first_sale = sold_items.first()
            correct_section = first_sale.listing_section
            correct_pipeline = first_sale.pipeline

            if not correct_section:
                context = first_sale.selected_services.get('_order_context', '')
                if first_sale.pipeline == 'G' or context == 'shares': correct_section = 'shares'
                elif context == 'adahi_pool': correct_section = 'adahi_pool'
                elif context == 'adahi_group': correct_section = 'adahi_group'
                else: correct_section = 'full_sale'

            total_sold = sold_items.aggregate(total=Sum('share_quantity'))['total'] or 0

            for listing in listings:
                if listing.section == correct_section:
                    #         ->   
                    real_available = listing.total_shares - total_sold
                    listing.available_shares = max(0, real_available)
                    listing.is_active = listing.available_shares > 0
                    listing.save()
                else:
                    #    () ->     
                    listing.is_active = False
                    listing.available_shares = listing.total_shares
                    listing.save()

            active_listings = AnimalListing.objects.filter(animal=animal, is_active=True)
            if not active_listings.exists() and total_sold > 0:
                animal.status = 'sold'
            else:
                animal.status = 'available'

            animal.lock_type = correct_section
            animal.save()
            fixed_count += 1

        self.stdout.write(self.style.SUCCESS(f'Successfully processed and fixed {fixed_count} animals.'))
