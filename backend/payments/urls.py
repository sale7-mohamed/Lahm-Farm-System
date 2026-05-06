from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet, paymob_webhook, paymob_callback

router = DefaultRouter()
router.register(r'', PaymentViewSet, basename='payments')

urlpatterns =[
    path('webhook/', paymob_webhook, name='paymob-webhook'),
    path('callback/', paymob_callback, name='paymob-callback'),
    path('', include(router.urls)),
]


