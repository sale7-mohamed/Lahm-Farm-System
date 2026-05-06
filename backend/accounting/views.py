# accounting/views.py

from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from datetime import date

from .models import Account, JournalEntry, Expense
from .serializers import (
    AccountSerializer,
    JournalEntrySerializer,
    ExpenseSerializer,
    ProfitAndLossSerializer,
)
from management.permissions import IsManagementUser
from management.permissions_engine import get_effective_access, get_approver_for_module
from management.models import AccessLevel, ApprovalRequest, SystemModule

class AccountViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Account.objects.filter(is_active=True)
    serializer_class = AccountSerializer
    permission_classes = [IsManagementUser]
    pagination_class = None

class JournalEntryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = JournalEntry.objects.prefetch_related('lines__account').all()
    serializer_class = JournalEntrySerializer
    permission_classes = [IsManagementUser]

class ExpenseViewSet(viewsets.ModelViewSet):
    queryset = Expense.objects.select_related(
        'expense_account', 'payment_account', 'created_by'
    ).all().order_by('-date')
    serializer_class = ExpenseSerializer
    permission_classes = [IsManagementUser]

    def create(self, request, *args, **kwargs):
        from management.models import SystemModule, AccessLevel
        from management.permissions_engine import get_effective_access
        access = get_effective_access(request.user, SystemModule.ACCOUNTING)
        if access in [AccessLevel.NO_ACCESS, AccessLevel.VIEW_ONLY]:
            raise PermissionDenied("ليس لديك صلاحية لإنشاء مصروف.")
        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        access = get_effective_access(request.user, SystemModule.ACCOUNTING)
        if access in [AccessLevel.NO_ACCESS, AccessLevel.VIEW_ONLY]:
            raise PermissionDenied("ليس لديك صلاحية لحذف المصروفات.")

        instance = self.get_object()

        if access == AccessLevel.REQUIRE_APPROVAL:
            approver = get_approver_for_module(SystemModule.ACCOUNTING)
            if not approver:
                raise PermissionDenied("لا يوجد مسؤول متاح للموافقة.")

            ApprovalRequest.objects.create(
                requester=request.user,
                approver=approver,
                action_type='delete_expense',
                target_module=SystemModule.ACCOUNTING,
                target_object_id=instance.id,
                details={
                    'description': instance.description,
                    'amount': str(instance.amount)
                },
                status='pending'
            )
            return Response(
                {"detail": "تم إرسال طلب حذف المصروف للمدير للموافقة."},
                status=200
            )

        instance.delete()
        return Response({"detail": "تم الحذف بنجاح."}, status=200)

class FinancialReportAPIView(APIView):
    permission_classes = [IsManagementUser]

    def get(self, request, *args, **kwargs):
        report_type = request.query_params.get('report', 'pnl')
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date', date.today().isoformat())

        try:
            start_date = date.fromisoformat(start_date_str) if start_date_str else None
            end_date = date.fromisoformat(end_date_str) if end_date_str else date.today()
        except ValueError:
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if report_type == 'pnl':
            data = self.get_profit_and_loss(start_date, end_date)
            return Response(data)

        return Response(
            {"error": "Invalid report type specified."},
            status=status.HTTP_400_BAD_REQUEST
        )

    def get_profit_and_loss(self, start_date, end_date):
        revenue_accounts = Account.objects.filter(account_type=Account.AccountType.REVENUE)
        cogs_accounts = Account.objects.filter(account_type=Account.AccountType.COST_OF_GOODS_SOLD)
        expense_accounts = Account.objects.filter(account_type=Account.AccountType.EXPENSE)

        total_revenue = sum(acc.get_balance(start_date, end_date) for acc in revenue_accounts)
        total_cogs = sum(acc.get_balance(start_date, end_date) for acc in cogs_accounts)
        total_expenses = sum(acc.get_balance(start_date, end_date) for acc in expense_accounts)

        gross_profit = total_revenue - total_cogs
        net_profit = gross_profit - total_expenses

        details = {
            'revenue_breakdown': {
                acc.name: acc.get_balance(start_date, end_date) for acc in revenue_accounts
            },
            'cogs_breakdown': {
                acc.name: acc.get_balance(start_date, end_date) for acc in cogs_accounts
            },
            'expense_breakdown': {
                acc.name: acc.get_balance(start_date, end_date) for acc in expense_accounts
            },
        }

        report_data = {
            'revenue': total_revenue,
            'cost_of_goods_sold': total_cogs,
            'gross_profit': gross_profit,
            'expenses': total_expenses,
            'net_profit': net_profit,
            'details': details
        }

        serializer = ProfitAndLossSerializer(report_data)
        return serializer.data
