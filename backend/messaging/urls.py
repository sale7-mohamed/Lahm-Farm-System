from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MessageLogViewSet, MessageTemplateViewSet, SendMessageView,
    ProviderInfoView, ProviderOperatorsView, ExternalSmsLogsView,
    MessagingConfigView
)

router = DefaultRouter()
router.register(r'logs', MessageLogViewSet, basename='message-logs')
router.register(r'templates', MessageTemplateViewSet, basename='message-templates')
router.register(r'send', SendMessageView, basename='message-sender')

urlpatterns = [
    path('provider-info/', ProviderInfoView.as_view(), name='provider-info'),
    path('provider-operators/', ProviderOperatorsView.as_view(), name='provider-operators'),
    path('external-logs/', ExternalSmsLogsView.as_view(), name='external-logs'),
    path('config/', MessagingConfigView.as_view(), name='messaging-config'),
    path('', include(router.urls)),
]

