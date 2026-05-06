# livestock/management/commands/setup_defaults.py
from django.core.management.base import BaseCommand
from livestock.models import DeliverySetting, ServicePriceSetting
from decimal import Decimal

class Command(BaseCommand):
    help = 'Creates default settings for delivery and services if they do not exist.'

    def handle(self, *args, **options):
        # Default Delivery Setting
        if not DeliverySetting.objects.exists():
            DeliverySetting.objects.create(
                delivery_days=["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                pickup_days=["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                preparation_days=2,
                free_care_days=4,
                min_deposit_percentage=Decimal('0.25'),
                service_deposit_percentage=Decimal('0.50')
            )
            self.stdout.write(self.style.SUCCESS('Successfully created default DeliverySetting.'))
        else:
            self.stdout.write('DeliverySetting already exists.')

        default_services = {
            "ذبح": Decimal('250.00'),
            "تقطيع": Decimal('150.00'),
            "تعبئة": Decimal('50.00'),
        }

        for name, price in default_services.items():
            obj, created = ServicePriceSetting.objects.get_or_create(
                name=name,
                defaults={'price': price, 'is_active': True}
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Successfully created default service: {name}'))

        self.stdout.write(self.style.SUCCESS('Default settings setup is complete.'))
