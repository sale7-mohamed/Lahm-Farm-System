# core/urls.py
from django.urls import path
from .views import CountryListAPIView, GovernorateListAPIView, PublicGlobalDiscountView, PublicOperationSettingsView

urlpatterns = [
    path("countries/", CountryListAPIView.as_view(), name="countries"),
    path("governorates/", GovernorateListAPIView.as_view(), name="governorates"),
    path("public-discount-settings/", PublicGlobalDiscountView.as_view(), name="public-discount"),

    path("public-operation-settings/", PublicOperationSettingsView.as_view(), name="public-operations"),
]
