# accounting/signals.py
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType
from decimal import Decimal
from datetime import date
from .models import Account, JournalEntry, TransactionLine, Expense
from . import services

def get_account(account_number):
    try:
        return Account.objects.get(account_number=account_number)
    except Account.DoesNotExist:
        raise Exception(f"CRITICAL: Account with number {account_number} not found. Please create it in the admin.")

@receiver(post_save, sender='livestock.Animal')
def record_livestock_entry(sender, instance, created, **kwargs):
    content_type = ContentType.objects.get_for_model(instance)
    cost_basis = instance.purchase_price

    if created:
        if cost_basis <= 0:
            return

        if JournalEntry.objects.filter(content_type=content_type, object_id=instance.id).exists():
            return

        livestock_inventory_acc = get_account('1200')

        if instance.entry_type == 'born_on_farm':
            internal_production_acc = get_account('4100')
            je = JournalEntry.objects.create(
                date=instance.birth_date,
                description=f"New birth recorded: Animal {instance.code}",
                content_type=content_type, object_id=instance.id
            )
            TransactionLine.objects.create(journal_entry=je, account=livestock_inventory_acc, amount=cost_basis, entry_type='DEBIT')
            TransactionLine.objects.create(journal_entry=je, account=internal_production_acc, amount=cost_basis, entry_type='CREDIT')

        elif instance.entry_type == 'purchased':
            cash_acc = get_account('1010')
            je = JournalEntry.objects.create(
                date=instance.created_at.date(),
                description=f"Purchase of animal {instance.code}",
                content_type=content_type, object_id=instance.id
            )
            TransactionLine.objects.create(journal_entry=je, account=livestock_inventory_acc, amount=cost_basis, entry_type='DEBIT')
            TransactionLine.objects.create(journal_entry=je, account=cash_acc, amount=cost_basis, entry_type='CREDIT')

    elif not created:
        if cost_basis <= 0: return

        if instance.status == 'sold':
            if JournalEntry.objects.filter(content_type=content_type, object_id=instance.id, description__icontains='COGS').exists(): return
            cogs_acc = get_account('5000')
            livestock_inventory_acc = get_account('1200')
            je = JournalEntry.objects.create(date=date.today(), description=f"COGS for sold animal {instance.code}", content_type=content_type, object_id=instance.id)
            TransactionLine.objects.create(journal_entry=je, account=cogs_acc, amount=cost_basis, entry_type='DEBIT')
            TransactionLine.objects.create(journal_entry=je, account=livestock_inventory_acc, amount=cost_basis, entry_type='CREDIT')

        elif instance.status == 'lost':
            if JournalEntry.objects.filter(content_type=content_type, object_id=instance.id, description__icontains='Loss').exists(): return
            loss_acc = get_account('5200')
            livestock_inventory_acc = get_account('1200')
            je = JournalEntry.objects.create(date=date.today(), description=f"Loss of animal {instance.code}", content_type=content_type, object_id=instance.id)
            TransactionLine.objects.create(journal_entry=je, account=loss_acc, amount=cost_basis, entry_type='DEBIT')
            TransactionLine.objects.create(journal_entry=je, account=livestock_inventory_acc, amount=cost_basis, entry_type='CREDIT')

@receiver(post_save, sender='reservation.Reservation')
def record_sale_from_reservation(sender, instance, **kwargs):
    if instance.status == 'completed' and instance.total_calculated_price > 0:
        content_type = ContentType.objects.get_for_model(instance)
        if JournalEntry.objects.filter(content_type=content_type, object_id=instance.id).exists(): return

        sales_revenue_acc = get_account('4000')
        cash_acc = get_account('1010')

        je = JournalEntry.objects.create(
            date=instance.reserved_at.date(),
            description=f"Sale from reservation for Animal {instance.animal.code}. Reservation ID: {instance.id}",
            created_by_customer=instance.user,
            content_type=content_type,
            object_id=instance.id
        )
        TransactionLine.objects.create(journal_entry=je, account=cash_acc, amount=instance.total_calculated_price, entry_type='DEBIT')
        TransactionLine.objects.create(journal_entry=je, account=sales_revenue_acc, amount=instance.total_calculated_price, entry_type='CREDIT')

@receiver(post_save, sender='management.Payroll')
def record_salary_payment(sender, instance, **kwargs):
    if instance.is_paid and instance.net_salary > 0:
        content_type = ContentType.objects.get_for_model(instance)
        if JournalEntry.objects.filter(content_type=content_type, object_id=instance.id).exists(): return

        salaries_expense_acc = get_account('6000')
        cash_acc = get_account('1010')

        je = JournalEntry.objects.create(
            date=instance.paid_date,
            description=f"Salary payment for {instance.employee.full_name} for {instance.month}/{instance.year}",
            created_by_employee=instance.employee,
            content_type=content_type,
            object_id=instance.id
        )
        TransactionLine.objects.create(journal_entry=je, account=salaries_expense_acc, amount=instance.net_salary, entry_type='DEBIT')
        TransactionLine.objects.create(journal_entry=je, account=cash_acc, amount=instance.net_salary, entry_type='CREDIT')

@receiver(post_save, sender='management.StockMovement')
def record_inventory_movement(sender, instance, created, **kwargs):
    if created and instance.movement_type == 'purchase':
        assumed_cost_per_unit = Decimal('15.0')
        total_cost = instance.quantity * assumed_cost_per_unit
        if total_cost <= 0: return

        if instance.item.type == 'feed':
            inventory_acc = get_account('1210')
        elif instance.item.type == 'medicine':
            inventory_acc = get_account('1220')
        else:
            return

        cash_acc = get_account('1010')

        je = JournalEntry.objects.create(
            date=instance.timestamp.date(),
            description=f"Purchase of {instance.quantity} {instance.item.unit_of_measure} of {instance.item.name}",
            created_by_employee=instance.user,
            content_type=ContentType.objects.get_for_model(instance),
            object_id=instance.id
        )
        TransactionLine.objects.create(journal_entry=je, account=inventory_acc, amount=total_cost, entry_type='DEBIT')
        TransactionLine.objects.create(journal_entry=je, account=cash_acc, amount=total_cost, entry_type='CREDIT')

@receiver(post_save, sender='management.FeedingLog')
def record_feed_usage(sender, instance, created, **kwargs):
    if created:
        assumed_cost_per_kg = Decimal('15.0')
        total_cost = instance.quantity_kg * assumed_cost_per_kg
        if total_cost <= 0: return

        feed_expense_acc = get_account('5100')
        feed_inventory_acc = get_account('1210')

        je = JournalEntry.objects.create(
            date=instance.timestamp.date(),
            description=f"Feed consumption: {instance.quantity_kg}kg for animal {instance.animal.code}",
            created_by_employee=instance.user,
            content_type=ContentType.objects.get_for_model(instance),
            object_id=instance.id
        )
        TransactionLine.objects.create(journal_entry=je, account=feed_expense_acc, amount=total_cost, entry_type='DEBIT')
        TransactionLine.objects.create(journal_entry=je, account=feed_inventory_acc, amount=total_cost, entry_type='CREDIT')

@receiver(post_save, sender='accounting.Expense')
def create_journal_entry_for_expense_signal(sender, instance, created, **kwargs):
    if created:
        services.create_journal_entry_for_expense(instance)
    else:
        from django.contrib.contenttypes.models import ContentType
        from .models import JournalEntry
        content_type = ContentType.objects.get_for_model(instance)
        je = JournalEntry.objects.filter(content_type=content_type, object_id=instance.id).first()
        if je:
            je.description = instance.description
            je.date = instance.date
            je.save()
            je.lines.filter(entry_type='DEBIT').update(account=instance.expense_account, amount=instance.amount)
            je.lines.filter(entry_type='CREDIT').update(account=instance.payment_account, amount=instance.amount)

@receiver(post_save, sender='orders.Order')
def record_order_transaction(sender, instance, created, **kwargs):

    if instance.status not in ['completed', 'delivered']:
        return

    content_type = ContentType.objects.get_for_model(instance)

    if JournalEntry.objects.filter(content_type=content_type, object_id=instance.id).exists():
        return

    sales_revenue_acc = get_account('4000')
    cash_acc = get_account('1010')

    if not sales_revenue_acc or not cash_acc:
        return

    je = JournalEntry.objects.create(
        date=date.today(),
        description=f"Sales Order #{instance.id} - {instance.user.full_name}",
        created_by_employee=instance.created_by_employee,
        created_by_customer=instance.user if not instance.created_by_employee else None,
        content_type=content_type,
        object_id=instance.id
    )

    TransactionLine.objects.create(journal_entry=je, account=cash_acc, amount=instance.total_price, entry_type='DEBIT')
    TransactionLine.objects.create(journal_entry=je, account=sales_revenue_acc, amount=instance.total_price, entry_type='CREDIT')

@receiver(pre_delete, sender=Expense)
def delete_journal_entry_for_expense(sender, instance, **kwargs):

    content_type = ContentType.objects.get_for_model(instance)
    JournalEntry.objects.filter(content_type=content_type, object_id=instance.id).delete()
