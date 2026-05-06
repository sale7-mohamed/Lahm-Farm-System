# accounting/services.py
from .models import JournalEntry, TransactionLine
from django.contrib.contenttypes.models import ContentType

def create_journal_entry_for_expense(expense_instance):
    """
    Creates a balanced journal entry for a given Expense object.
    """
    # Create the main journal entry record
    je = JournalEntry.objects.create(
        date=expense_instance.date,
        description=expense_instance.description,
        created_by_employee=expense_instance.created_by,
        content_type=ContentType.objects.get_for_model(expense_instance),
        object_id=expense_instance.id
    )

    # Debit the relevant expense account
    TransactionLine.objects.create(
        journal_entry=je,
        account=expense_instance.expense_account,
        amount=expense_instance.amount,
        entry_type='DEBIT'
    )

    # Credit the payment account
    TransactionLine.objects.create(
        journal_entry=je,
        account=expense_instance.payment_account,
        amount=expense_instance.amount,
        entry_type='CREDIT'
    )

    return je

