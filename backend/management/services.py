# management/services.py
from livestock.models import Animal
from .models import InventoryItem, FeedingRule, PayrollEntry
from datetime import date, timedelta
from django.db.models import F, Sum, Q
from decimal import Decimal #  :  Decimal

def calculate_feed_depletion_forecast():
    """
            .
    """
    all_animals = Animal.objects.filter(status__in=['available', 'reserved'])
    feeding_rules = FeedingRule.objects.all().select_related('category')

    main_feed_item = InventoryItem.objects.filter(type='feed', name__icontains='مركز').first()

    if not main_feed_item:
        return []

    total_daily_consumption = Decimal('0.0')

    for animal in all_animals:
        rule = next((r for r in feeding_rules if r.category_id == animal.category_id and r.min_weight_kg <= animal.weight_kg <= r.max_weight_kg), None)

        if rule:
            daily_intake = (animal.weight_kg * rule.feed_percentage_of_body_weight) / Decimal('100')
            total_daily_consumption += daily_intake

    forecast = []
    if total_daily_consumption > 0:
        days_left = main_feed_item.current_stock / total_daily_consumption
        depletion_date = date.today() + timedelta(days=int(days_left))
        forecast.append({
            'item_name': main_feed_item.name,
            'current_stock': main_feed_item.current_stock,
            'unit': main_feed_item.unit_of_measure,
            'daily_consumption_kg': total_daily_consumption,
            'days_left': int(days_left),
            'depletion_date': depletion_date,
        })

    return forecast

def calculate_net_salary(payroll_instance):
    """
    Calculates and updates the net_salary for a given payroll instance
    based on its associated PayrollEntry items.
    """
    if not payroll_instance:
        return

    entries = payroll_instance.entries.all()

    # Aggregate allowances and deductions in a single query
    totals = entries.aggregate(
        total_allowances=Sum('amount', filter=Q(entry_type__in=['base_salary', 'allowance'])),
        total_deductions=Sum('amount', filter=Q(entry_type__in=['deduction', 'advance']))
    )

    total_allowances = totals.get('total_allowances') or Decimal('0.00')
    total_deductions = totals.get('total_deductions') or Decimal('0.00')

    net_salary = total_allowances - total_deductions

    # Update the payroll instance without triggering post_save signals yet
    payroll_instance.net_salary = net_salary
    payroll_instance.save(update_fields=['net_salary'])

    return net_salary
