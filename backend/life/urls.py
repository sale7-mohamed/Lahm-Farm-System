from django.urls import re_path
from django.views.static import serve
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.sitemaps.views import sitemap
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from .views import CustomTokenRefreshView
from cart.views import MergeGuestCartAPIView, GuestCartAPIView
from orders.views import invoice_view, receipt_view, delivery_note_view, bulk_print_view, print_employee_contract, print_farm_contract, print_b2b_contract, print_supplier_receipt
from livestock.sitemaps import AnimalSitemap
from django.contrib.staticfiles.urls import staticfiles_urlpatterns

sitemaps = {
    'animals': AnimalSitemap,
}

class GuestCartAPIViewNoAuth(GuestCartAPIView):
    authentication_classes = []
    permission_classes = [AllowAny]

admin.site.site_url = settings.ADMIN_SITE_URL

urlpatterns = [
    path('admin/', admin.site.urls),
    path('sitemap.xml', sitemap, {'sitemaps': sitemaps}, name='django.contrib.sitemaps.views.sitemap'),

    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),

    path('api/accounts/', include('accounts.urls', namespace='accounts')),
    path('api/cart/guest-cart/', GuestCartAPIViewNoAuth.as_view(), name='guest-cart-no-auth'),
    path('api/cart/', include('cart.urls')),
    path('api/cart/merge-guest-cart/', MergeGuestCartAPIView.as_view(), name='merge-guest-cart'),

    path('api/core/', include('core.urls')),
    path('api/livestock/', include('livestock.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/orders/', include('orders.urls')),
    path('api/reservation/', include('reservation.urls')),
    path('api/management/', include('management.urls', namespace='management')),
    path('api/accounting/', include('accounting.urls')),
    path('api/partnerships/', include('partnerships.urls')),
    path('api/messaging/', include('messaging.urls')),
    path('api/webpush/', include('webpush.urls')),

    path('api/orders/invoice/<int:order_id>/', invoice_view, name='order-invoice'),
    path('api/orders/receipt/<int:order_id>/', receipt_view, name='order-receipt'),
    path('api/orders/delivery-note/<int:order_id>/', delivery_note_view, name='order-delivery-note'),
    path('api/orders/bulk-print/', bulk_print_view, name='order-bulk-print'),
    path('api/contracts/employee/', print_employee_contract, name='print-employee-contract'),
    path('api/contracts/farm/', print_farm_contract, name='print-farm-contract'),
    path('api/contracts/b2b/', print_b2b_contract, name='print-b2b-contract'),
    path('api/contracts/supplier-receipt/', print_supplier_receipt, name='print-supplier-receipt'),
]

urlpatterns +=[
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
]
urlpatterns += staticfiles_urlpatterns()

