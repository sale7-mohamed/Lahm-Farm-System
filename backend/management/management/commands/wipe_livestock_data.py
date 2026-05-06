from django.core.management.base import BaseCommand
from django.db import transaction
from livestock.models import Animal, AnimalListing, AdahiGroup
from orders.models import Order, OrderItem, BusinessRequest, SpecialRequest, Shipment
from cart.models import Cart, CartItem
from reservation.models import Reservation
from accounting.models import JournalEntry, TransactionLine, Expense
from payments.models import Payment

class Command(BaseCommand):
    help = 'Wipes all livestock, orders, and related transaction data for a fresh start.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting data wipe..."))

        with transaction.atomic():
            # 1. Clear Carts & Reservations
            CartItem.objects.all().delete()
            # Cart.objects.all().delete() # Optional: Keep empty carts linked to users
            Reservation.objects.all().delete()
            self.stdout.write("Cart items and Reservations deleted.")

            # 2. Clear Payments & Financials
            Payment.objects.all().delete()
            Expense.objects.all().delete()
            TransactionLine.objects.all().delete()
            JournalEntry.objects.all().delete()
            self.stdout.write("Payments and Journal Entries deleted.")

            # 3. Clear Orders & Requests
            OrderItem.objects.all().delete()
            Order.objects.all().delete()
            Shipment.objects.all().delete()
            BusinessRequest.objects.all().delete()
            SpecialRequest.objects.all().delete()
            self.stdout.write("Orders, Shipments, and Requests deleted.")

            # 4. Clear Livestock Data
            # Note: Listings and AdahiGroups cascade delete with Animal
            AnimalListing.objects.all().delete()
            AdahiGroup.objects.all().delete()
            deleted_animals = Animal.objects.all().delete()
            self.stdout.write(f"Livestock deleted: {deleted_animals}")

        self.stdout.write(self.style.SUCCESS("Successfully wiped all operational data. Users and Employees remain intact."))

