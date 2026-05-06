# core/management/commands/setup_core.py
from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import Country, Governorate

class Command(BaseCommand):
    help = 'Creates default countries and governorates for Egypt.'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Setting up core data...")

        # Create Country
        egypt, created = Country.objects.get_or_create(
            code="EG",
            defaults={
                'name_ar': "مصر",
                'name_en': "Egypt",
                'currency': "EGP",
                'is_default': True
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS('Successfully created Country: Egypt'))
        else:
            self.stdout.write('Country "Egypt" already exists.')

        governorates = [
            ("أسوان", "Aswan"),
            ("أسيوط", "Assiut"),
            ("الإسكندرية", "Alexandria"),
            ("الإسماعيلية", "Ismailia"),
            ("الأقصر", "Luxor"),
            ("البحر الأحمر", "Red Sea"),
            ("البحيرة", "Beheira"),
            ("الجيزة", "Giza"),
            ("الدقهلية", "Dakahlia"),
            ("السويس", "Suez"),
            ("الشرقية", "Sharqia"),
            ("الغربية", "Gharbia"),
            ("الفيوم", "Fayoum"),
            ("القاهرة", "Cairo"),
            ("القليوبية", "Qalyubia"),
            ("المنوفية", "Monufia"),
            ("المنيا", "Minya"),
            ("الوادي الجديد", "New Valley"),
            ("بني سويف", "Beni Suef"),
            ("بورسعيد", "Port Said"),
            ("جنوب سيناء", "South Sinai"),
            ("دمياط", "Damietta"),
            ("سوهاج", "Sohag"),
            ("شمال سيناء", "North Sinai"),
            ("قنا", "Qena"),
            ("كفر الشيخ", "Kafr El Sheikh"),
            ("مطروح", "Matruh")
        ]

        count = 0
        for name_ar, name_en in governorates:
            gov, created = Governorate.objects.update_or_create(
                country=egypt,
                name_ar=name_ar,
                defaults={'name_en': name_en}
            )
            if created:
                self.stdout.write(f'  -> Created: {name_ar} / {name_en}')
                count += 1
            else:
                self.stdout.write(f'  -> Updated: {name_ar} / {name_en}')

        self.stdout.write(self.style.SUCCESS(f'Setup complete. Processed {len(governorates)} governorates.'))
