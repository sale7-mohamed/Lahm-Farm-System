# livestock/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet,
    AnimalViewSet,
    AdahiGroupViewSet,
    HomeAPIView,
    ClientServiceQuestionListView,
    AvailableDatesView,
    DeliveryAreaListView,
    ServicePriceSettingViewSet,
    DeliverySettingDetailView,
    qr_code_redirect_view,
    calculate_price_preview,
    MarketPipelineViewSet,
    SacrificePipelineViewSet,
    SharesPipelineViewSet
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'animals', AnimalViewSet, basename='animal')
router.register(r'service-prices', ServicePriceSettingViewSet, basename='service-prices')
router.register(r'adahi-groups', AdahiGroupViewSet, basename='adahi-group')
router.register(r'market', MarketPipelineViewSet, basename='pipeline-market')
router.register(r'sacrifices', SacrificePipelineViewSet, basename='pipeline-sacrifices')
router.register(r'shares', SharesPipelineViewSet, basename='pipeline-shares')

urlpatterns = [
    path('home/', HomeAPIView.as_view(), name='livestock-home'),
    path('available-dates/', AvailableDatesView.as_view(), name='available-dates'),
    path('delivery-settings/', DeliverySettingDetailView.as_view(), name='delivery-settings-detail'),
    path('q/<uuid:unique_id>/', qr_code_redirect_view, name='qr-redirect'),
    path('calculate-price-preview/', calculate_price_preview, name='calculate-price-preview'),
    path('', include(router.urls)),
    path('client-services/', ClientServiceQuestionListView.as_view(), name='client-services'),
    path('delivery-areas/', DeliveryAreaListView.as_view(), name='delivery-areas'),
]

