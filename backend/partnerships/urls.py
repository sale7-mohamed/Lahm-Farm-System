# partnerships/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PublicPartnershipCreateView, ManagementPartnershipViewSet

router = DefaultRouter()
router.register(r'manage', ManagementPartnershipViewSet, basename='partnership-manage')

urlpatterns = [
    #   (Public)
    path('apply/', PublicPartnershipCreateView.as_view(), name='partnership-apply'),

    path('', include(router.urls)),
]
