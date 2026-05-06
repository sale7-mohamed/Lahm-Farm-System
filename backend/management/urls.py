from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers
from .views import (
    EmployeeViewSet,
    FarmDepartmentViewSet,
    EmployeeRoleViewSet,
    StaffLoginAPIView,
    AnimalProfileAPIView,
    ApprovalRequestViewSet,
    InventoryItemViewSet,
    DashboardAPIView,
    FCRReportAPIView,
    WeightLogViewSet,
    FeedingLogViewSet,
    PurchaseOrderViewSet,
    PayrollViewSet,
    AnimalProfitabilityReportAPIView,
    ManagementOrderViewSet,
    AnimalImageViewSet,
    SupplierViewSet,
    ServicePriceSettingViewSet,
    DeliverySettingAPIView,
    OnFarmSaleAPIView,
    CustomerLookupAPIView,
    OrderLedgerAPIView,
    PermissionsViewSet,
    ChatRoomViewSet,
    ChatMessageViewSet,
    HealthLogViewSet,
    SpecialRequestViewSet,
    AdvancedReportAPIView,
    GlobalDiscountSettingsView,
    DiscountLogListView,
    AttendanceLogViewSet,
    StockMovementViewSet,
    OperationSettingsView,
    VehicleViewSet,
    DispatcherView,
    ButcherScreenView,
    FarmPrepView,
    FridgeManagerView,
    DriverAppView,
    DailyReconciliationView,
    JobOpeningViewSet,
    JobApplicationViewSet,
    ShiftSummaryView,
    AnimalViewSet as ManagementAnimalViewSet,
    DeliveryAreaViewSet,
    ContactMessageViewSet,
    CustomerCallLogViewSet,
    DocumentArchiveViewSet,
    update_driver_location,
    advance_shipment_step,
    CorporateCustomersAPIView,
    RecentOrdersAPIView,
    ManageCustomerAddressViewSet,
    AdminNotificationViewSet,
    SmartActionPlanView,
    AccessRuleBulkUpdateView,
    ApprovalRoutingSetView,
    system_modules_list,
)
from livestock.views import ReorderImagesAPIView

app_name = 'management'

router = DefaultRouter()
router.register(r'employees', EmployeeViewSet, basename='employee')
router.register(r'departments', FarmDepartmentViewSet, basename='department')
router.register(r'roles', EmployeeRoleViewSet, basename='role')
router.register(r'approvals', ApprovalRequestViewSet, basename='approval')
router.register(r'inventory-items', InventoryItemViewSet, basename='inventory-item')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-order')
router.register(r'payrolls', PayrollViewSet, basename='payroll')
router.register(r'orders', ManagementOrderViewSet, basename='management-order')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'animals', ManagementAnimalViewSet, basename='management-animal')
router.register(r'service-prices', ServicePriceSettingViewSet, basename='service-price')
router.register(r'permissions', PermissionsViewSet, basename='permission')
router.register(r'chat/rooms', ChatRoomViewSet, basename='chat-room')
router.register(r'special-requests', SpecialRequestViewSet, basename='special-request')
router.register(r'attendance', AttendanceLogViewSet, basename='attendance')
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movement')
router.register(r'vehicles', VehicleViewSet, basename='vehicle')
router.register(r'jobs', JobOpeningViewSet, basename='job-opening')
router.register(r'job-applications', JobApplicationViewSet, basename='job-application')
router.register(r'delivery-areas', DeliveryAreaViewSet, basename='management-delivery-areas')
router.register(r'contact-messages', ContactMessageViewSet, basename='contact-message')
router.register(r'call-logs', CustomerCallLogViewSet, basename='call-log')
router.register(r'document-archive', DocumentArchiveViewSet, basename='document-archive')
router.register(r'customer-addresses', ManageCustomerAddressViewSet, basename='manage-address')
router.register(r'all-notifications', AdminNotificationViewSet, basename='all-notifications')

animals_router = routers.NestedSimpleRouter(router, r'animals', lookup='animal')
animals_router.register(r'images', AnimalImageViewSet, basename='animal-images')
animals_router.register(r'weight-logs', WeightLogViewSet, basename='animal-weight-logs')
animals_router.register(r'health-logs', HealthLogViewSet, basename='animal-health-logs')

chat_messages_router = routers.NestedSimpleRouter(router, r'chat/rooms', lookup='room')
chat_messages_router.register(r'messages', ChatMessageViewSet, basename='chat-messages')

urlpatterns = [
    path('chat/rooms/<int:room_pk>/messages/<int:pk>/delete_message/',
         ChatMessageViewSet.as_view({'delete': 'delete_message'}),
         name='chat-message-delete'),
    path('animals/<str:animal_unique_id>/reorder-images/', ReorderImagesAPIView.as_view(), name='reorder-images'),
    path('', include(router.urls)),
    path('', include(animals_router.urls)),
    path('', include(chat_messages_router.urls)),
    path('dashboard/', DashboardAPIView.as_view(), name='dashboard'),
    path('auth/login/', StaffLoginAPIView.as_view(), name='staff-login'),
    path('animal-profile/<uuid:unique_id>/', AnimalProfileAPIView.as_view(), name='animal-profile'),
    path('reports/profitability/', AnimalProfitabilityReportAPIView.as_view(), name='report-profitability'),
    path('reports/fcr/', FCRReportAPIView.as_view(), name='report-fcr'),
    path('reports/advanced/', AdvancedReportAPIView.as_view(), name='report-advanced'),
    path('on-farm-sale/', OnFarmSaleAPIView.as_view(), name='on-farm-sale'),
    path('delivery-settings/', DeliverySettingAPIView.as_view(), name='delivery-settings'),
    path('customer-lookup/', CustomerLookupAPIView.as_view(), name='customer-lookup'),
    path('order-ledger/', OrderLedgerAPIView.as_view(), name='order-ledger'),
    path('global-discounts/', GlobalDiscountSettingsView.as_view(), name='global-discounts'),
    path('discount-logs/', DiscountLogListView.as_view(), name='discount-logs'),
    path('operation-settings/', OperationSettingsView.as_view(), name='operation-settings'),
    path('dispatcher/', DispatcherView.as_view(), name='dispatcher'),
    path('dispatcher/<int:order_id>/', DispatcherView.as_view(), name='dispatcher-update'),
    path('butcher-screen/', ButcherScreenView.as_view(), name='butcher-screen'),
    path('farm-prep/', FarmPrepView.as_view(), name='farm-prep'),
    path('fridge-manager/', FridgeManagerView.as_view(), name='fridge-manager'),
    path('driver-app/', DriverAppView.as_view(), name='driver-app'),
    path('shipments/<int:shipment_id>/update-location/', update_driver_location, name='update-driver-location'),
    path('shipments/<int:shipment_id>/advance-step/', advance_shipment_step, name='advance-shipment-step'),
    path('reconciliation/', DailyReconciliationView.as_view(), name='daily-reconciliation'),
    path('shift-summary/', ShiftSummaryView.as_view(), name='shift-summary'),
    path('corporate-customers/', CorporateCustomersAPIView.as_view(), name='corporate-customers'),
    path('recent-orders/', RecentOrdersAPIView.as_view(), name='recent-orders'),
    path('smart-action-plan/', SmartActionPlanView.as_view(), name='smart-action-plan'),
    path('access-rules/bulk_update/', AccessRuleBulkUpdateView.as_view(), name='access-rules-update'),
    path('approval-routing/', ApprovalRoutingSetView.as_view(), name='approval-routing-get'),
    path('approval-routing/set/', ApprovalRoutingSetView.as_view(), name='approval-routing-set'),
    path('system-modules/', system_modules_list, name='system-modules-list'),
]

