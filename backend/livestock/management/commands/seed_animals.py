# livestock/management/commands/seed_animals.py

import random
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from livestock.models import Animal, Category
from management.models import Supplier, WeightLog

class Command(BaseCommand):
    help = 'يضيف 25 حيواناً ببيانات عشوائية ومنطقية للتجربة'

    def handle(self, *args, **options):
        self.stdout.write("جاري تجهيز البيانات...")

        # 1.     
        categories_data = [
            {'name_ar': 'عجول تسمين', 'slug': 'calves', 'min_w': 350, 'max_w': 550, 'price_per_kg': 160},
            {'name_ar': 'خراف بلدي', 'slug': 'sheep', 'min_w': 45, 'max_w': 75, 'price_per_kg': 190},
            {'name_ar': 'ماعز', 'slug': 'goats', 'min_w': 25, 'max_w': 50, 'price_per_kg': 210},
        ]

        db_categories = []
        for cat_data in categories_data:
            category, _ = Category.objects.get_or_create(
                name_ar=cat_data['name_ar'],
                defaults={
                    'name_en': cat_data['slug'],
                    'slug': cat_data['slug'],
                    'standard_birth_cost': 5000 if 'عجول' in cat_data['name_ar'] else 1000,
                    'daily_care_fee': 50 if 'عجول' in cat_data['name_ar'] else 20,
                    'default_max_shares': 7 if 'عجول' in cat_data['name_ar'] else 1
                }
            )

            category.min_w = cat_data['min_w']
            category.max_w = cat_data['max_w']
            category.price_per_kg = cat_data['price_per_kg']
            db_categories.append(category)

        # 2.     ( )
        supplier, _ = Supplier.objects.get_or_create(
            name="مزرعة الأمل للمواشي",
            defaults={'phone': '01000000000', 'supplier_type': 'LIVESTOCK_FARM'}
        )

        # 3.  25 
        for i in range(25):

            selected_cat = random.choice(db_categories)

            #   (   )
            sex = 'male' if random.random() > 0.2 else 'female'

            weight = random.randint(selected_cat.min_w, selected_cat.max_w)

            #      ()
            base_price = weight * selected_cat.price_per_kg
            #      (+- 5%)
            variation = random.uniform(0.95, 1.05)
            final_price = round(base_price * variation, -1) #   10

            #      ( )
            #    1     0.2 
            growth_rate = 30 if 'عجول' in selected_cat.name_ar else 5
            age_months = max(4, int(weight / growth_rate))
            birth_date = date.today() - timedelta(days=age_months * 30)

            #   (70%   30% )
            is_purchased = random.random() > 0.7
            entry_type = 'purchased' if is_purchased else 'born_on_farm'
            current_source = supplier if is_purchased else None

            is_offer = random.random() > 0.8 # 20% 
            discount = 0
            if is_offer:
                discount = random.choice([5, 10, 15])

            #    ( )
            is_shareable = False
            max_shares = 1
            if 'عجول' in selected_cat.name_ar and random.random() > 0.5:
                is_shareable = True
                max_shares = 7

            animal = Animal.objects.create(
                category=selected_cat,
                name=f"{selected_cat.name_ar} {i+1}",
                sex=sex,
                birth_date=birth_date,
                entry_type=entry_type,
                source_farm=current_source,
                purchase_price=final_price * 0.8,
                price_egp=final_price,
                is_offer=is_offer,
                discount_percent=discount,
                status='available',
                is_shareable=is_shareable,
                max_shares=max_shares,
                description=f"حيوان ممتاز بصحة جيدة، تغذية طبيعية 100%. مناسب { 'للأضحية' if weight > selected_cat.min_w * 1.2 else 'للتربية' }."
            )

            #    (      )
            WeightLog.objects.create(
                animal=animal,
                date=date.today(),
                weight_kg=weight,
                recorded_by=None
            )

            self.stdout.write(self.style.SUCCESS(f"تم إضافة: {animal.code} - {selected_cat.name_ar} ({weight} كجم)"))

        self.stdout.write(self.style.SUCCESS('---------------------------------'))
        self.stdout.write(self.style.SUCCESS(f'تمت إضافة 25 حيوان بنجاح!'))
