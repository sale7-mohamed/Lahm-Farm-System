# orders/urls.py
from rest_framework.routers import DefaultRouter
from .views import OrderViewSet, SpecialRequestViewSet, ShipmentViewSet, BusinessRequestViewSet

router = DefaultRouter()
router.register(r'list', OrderViewSet, basename='order')
router.register(r'special-requests', SpecialRequestViewSet, basename='special-request')
router.register(r'shipments', ShipmentViewSet, basename='shipment')
router.register(r'business-requests', BusinessRequestViewSet, basename='business-request')

urlpatterns = router.urls
