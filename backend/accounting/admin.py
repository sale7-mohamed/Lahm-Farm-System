# accounting/admin.py
from django.contrib import admin
from .models import Account, JournalEntry, TransactionLine, Expense

class TransactionLineInline(admin.TabularInline):
    model = TransactionLine
    extra = 2

@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('account_number', 'name', 'account_type', 'is_active')
    list_filter = ('account_type', 'is_active')
    search_fields = ('name', 'account_number')

@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ('date', 'description', 'total_debits', 'total_credits', 'is_balanced', 'created_at')
    list_filter = ('date',)
    search_fields = ('description',)
    inlines = [TransactionLineInline]
    readonly_fields = ('created_at',)

@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('date', 'description', 'amount', 'expense_account', 'payment_account', 'created_by')
    list_filter = ('date', 'expense_account', 'payment_account')
    search_fields = ('description',)
    raw_id_fields = ('created_by',)

