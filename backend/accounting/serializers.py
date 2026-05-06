# accounting/serializers.py
from rest_framework import serializers
from .models import Account, JournalEntry, TransactionLine, Expense
from django.db import transaction
from decimal import Decimal

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['id', 'account_number', 'name', 'account_type', 'description']

class TransactionLineSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = TransactionLine
        fields = ['id', 'account', 'account_name', 'amount', 'entry_type']

class JournalEntrySerializer(serializers.ModelSerializer):
    lines = TransactionLineSerializer(many=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = JournalEntry
        fields = ['id', 'date', 'description', 'lines', 'created_by_name', 'is_balanced']
        read_only_fields = ('is_balanced',)

    def get_created_by_name(self, obj):
        if obj.created_by_customer:
            return obj.created_by_customer.full_name
        if obj.created_by_employee:
            return obj.created_by_employee.full_name
        return "System"

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        with transaction.atomic():
            journal_entry = JournalEntry.objects.create(**validated_data)

            total_debits = Decimal('0.00')
            total_credits = Decimal('0.00')

            for line_data in lines_data:
                TransactionLine.objects.create(journal_entry=journal_entry, **line_data)
                if line_data['entry_type'] == 'DEBIT':
                    total_debits += line_data['amount']
                else:
                    total_credits += line_data['amount']

            if total_debits != total_credits:
                raise serializers.ValidationError("Journal entry is not balanced. Debits must equal credits.")

        return journal_entry

class ExpenseSerializer(serializers.ModelSerializer):
    """
    Serializer for creating simplified Expense records.
    The signal will handle the JournalEntry creation.
    """
    expense_account_details = AccountSerializer(source='expense_account', read_only=True)
    payment_account_details = AccountSerializer(source='payment_account', read_only=True)

    class Meta:
        model = Expense
        fields = ['id', 'date', 'description', 'amount', 'expense_account', 'payment_account', 'notes', 'expense_account_details', 'payment_account_details']

    def create(self, validated_data):
        # Set the user from the request context
        employee_user = self.context['request'].user
        if hasattr(employee_user, 'is_staff') and employee_user.is_staff:
             validated_data['created_by'] = employee_user
        else:
            raise serializers.ValidationError("Only staff members can create expenses.")
        return super().create(validated_data)

class ProfitAndLossSerializer(serializers.Serializer):
    revenue = serializers.DecimalField(max_digits=15, decimal_places=2)
    cost_of_goods_sold = serializers.DecimalField(max_digits=15, decimal_places=2)
    gross_profit = serializers.DecimalField(max_digits=15, decimal_places=2)
    expenses = serializers.DecimalField(max_digits=15, decimal_places=2)
    net_profit = serializers.DecimalField(max_digits=15, decimal_places=2)
    details = serializers.DictField()
