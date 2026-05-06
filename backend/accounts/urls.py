# accounts/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterAPIView, VerifyOTPAPIView, CheckAccountAPIView,
    LoginAPIView, MeAPIView, DetectCountryView,RequestPasswordResetAPIView,
    VerifyPasswordResetOTPAPIView,SetNewPasswordAPIView, AddressViewSet,
    ResendOTPAPIView  #      View 
)

app_name = "accounts"

router = DefaultRouter()
router.register(r'addresses', AddressViewSet, basename='address')

urlpatterns = [
    path('check-account/', CheckAccountAPIView.as_view(), name='check-account'),
    path('register/', RegisterAPIView.as_view(), name='register'),
    path('verify-otp/', VerifyOTPAPIView.as_view(), name='verify-otp'),

    path('resend-otp/', ResendOTPAPIView.as_view(), name='resend-otp'),
    path('login/', LoginAPIView.as_view(), name='login'),
    path('me/', MeAPIView.as_view(), name='me'),
    path('detect-country/', DetectCountryView.as_view(), name='detect-country'),
    path('reset-password/request/', RequestPasswordResetAPIView.as_view(), name='request-password-reset'),
    path('reset-password/verify/', VerifyPasswordResetOTPAPIView.as_view(), name='verify-password-reset-otp'),
    path('reset-password/set/', SetNewPasswordAPIView.as_view(), name='set-new-password'),

    path('', include(router.urls)),
]
