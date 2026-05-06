from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CartViewSet, CartItemViewSet, GuestCartAPIView, MergeGuestCartAPIView
item_router = DefaultRouter()
item_router.register(r'items', CartItemViewSet, basename='cart-items')
urlpatterns = [
    path('guest-cart/', GuestCartAPIView.as_view(), name='guest-cart'),
    path('merge-guest-cart/', MergeGuestCartAPIView.as_view(), name='merge-guest-cart'),
    path('', CartViewSet.as_view({
        'get': 'list',
        'post': 'create',
        'delete': 'destroy'
    }), name='cart-main'),
    path('', include(item_router.urls)),
]
