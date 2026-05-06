# accounting/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AccountViewSet, JournalEntryViewSet, ExpenseViewSet, FinancialReportAPIView

router = DefaultRouter()
router.register(r'accounts', AccountViewSet, basename='account')
router.register(r'journal-entries', JournalEntryViewSet, basename='journal-entry')
router.register(r'expenses', ExpenseViewSet, basename='expense')

urlpatterns = [
    path('', include(router.urls)),
    path('reports/', FinancialReportAPIView.as_view(), name='financial-reports'),
]

