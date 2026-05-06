# accounting/models.py
from django.db import models
from django.db.models import Sum, Q
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from decimal import Decimal

class Account(models.Model):
    """
    Represents a single account in the chart of accounts (e.g., Cash, Sales Revenue).
    This is the Ledger.
    """
    class AccountType(models.TextChoices):
        ASSET = 'ASSET', _('Asset')
        LIABILITY = 'LIABILITY', _('Liability')
        EQUITY = 'EQUITY', _('Equity')
        REVENUE = 'REVENUE', _('Revenue')
        EXPENSE = 'EXPENSE', _('Expense')
        COST_OF_GOODS_SOLD = 'COGS', _('Cost of Goods Sold')

    name = models.CharField(max_length=100, unique=True, verbose_name=_("Account Name"))
    account_number = models.CharField(max_length=20, unique=True, verbose_name=_("Account Number"))
    account_type = models.CharField(max_length=10, choices=AccountType.choices, verbose_name=_("Account Type"))
    description = models.TextField(blank=True, null=True, verbose_name=_("Description"))
    is_active = models.BooleanField(default=True, verbose_name=_("Is Active"))

    class Meta:
        verbose_name = _("Account")
        verbose_name_plural = _("Accounts")
        ordering = ['account_number']
        permissions = [
            ("view_financial_reports", "Can view financial reports"),
        ]

    def __str__(self):
        return f"{self.account_number} - {self.name}"

    def get_balance(self, start_date=None, end_date=None):
        """Calculates the balance for this account within a date range."""
        debits = Q(entry_type='DEBIT')
        credits = Q(entry_type='CREDIT')

        lines = self.lines.all()
        if start_date:
            lines = lines.filter(journal_entry__date__gte=start_date)
        if end_date:
            lines = lines.filter(journal_entry__date__lte=end_date)

        total_debits = lines.filter(debits).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        total_credits = lines.filter(credits).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        if self.account_type in [self.AccountType.ASSET, self.AccountType.EXPENSE, self.AccountType.COST_OF_GOODS_SOLD]:
            return total_debits - total_credits
        else: # LIABILITY, EQUITY, REVENUE
            return total_credits - total_debits

class JournalEntry(models.Model):
    """
    Represents a single financial transaction, which consists of multiple lines (debits and credits).
    This is the "Journal".
    """
    date = models.DateField(verbose_name=_("Date"))
    description = models.TextField(verbose_name=_("Description"))
    created_at = models.DateTimeField(auto_now_add=True)

    created_by_customer = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_by_employee = models.ForeignKey('management.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    # For linking to the source of the transaction (e.g., a Reservation, Payroll, etc.)
    content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    related_object = GenericForeignKey('content_type', 'object_id')

    class Meta:
        verbose_name = _("Journal Entry")
        verbose_name_plural = _("Journal Entries")
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"Entry on {self.date}: {self.description[:50]}"

    @property
    def total_debits(self):
        return self.lines.filter(entry_type='DEBIT').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    @property
    def total_credits(self):
        return self.lines.filter(entry_type='CREDIT').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    @property
    def is_balanced(self):
        return self.total_debits == self.total_credits

class TransactionLine(models.Model):
    """
    A single line item in a Journal Entry, representing a debit or credit to an Account.
    """
    class EntryType(models.TextChoices):
        DEBIT = 'DEBIT', _('Debit')
        CREDIT = 'CREDIT', _('Credit')

    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='lines')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    entry_type = models.CharField(max_length=6, choices=EntryType.choices)

    class Meta:
        verbose_name = _("Transaction Line")
        verbose_name_plural = _("Transaction Lines")

    def __str__(self):
        return f"{self.account} - {self.entry_type} {self.amount}"

class Expense(models.Model):
    """
    A simplified model for recording general expenses like rent, utilities, etc.
    This will create a JournalEntry behind the scenes.
    """
    date = models.DateField()
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    expense_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='+', limit_choices_to={'account_type': Account.AccountType.EXPENSE})
    payment_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='+', limit_choices_to={'account_type': Account.AccountType.ASSET}) # e.g., Cash, Bank
    notes = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey('management.Employee', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Expense: {self.description} on {self.date}"
