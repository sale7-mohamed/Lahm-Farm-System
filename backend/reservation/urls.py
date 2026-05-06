# D:\pro\life\reservation\urls.py

from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views import ReservationViewSet, InitialBookingRequestAPIView

router = DefaultRouter()
router.register('reservations', ReservationViewSet, basename='reservation')

urlpatterns = [
    path('initiate-booking/', InitialBookingRequestAPIView.as_view(), name='initiate-booking'),
    path('', include(router.urls)),
]

