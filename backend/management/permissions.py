from rest_framework.permissions import BasePermission

class IsManagementUser(BasePermission):
    """
    Allows access only to authenticated staff users. This is the main gatekeeper.
    It relies on the custom JWT backend to ensure request.user is an Employee instance.
    """
    def has_permission(self, request, view):
        from management.models import Employee
        return bool(
            request.user and
            request.user.is_authenticated and
            isinstance(request.user, Employee) and
            request.user.is_staff
        )

class HasPermission(BasePermission):
    """
    Custom permission to check if a user has a specific permission.
    Relies on the overridden `has_perm` method in the Employee model.
    Usage: permission_classes = [HasPermission("app_label.permission_codename")]
    """
    def __init__(self, *permissions):
        self.permissions = permissions

    def has_permission(self, request, view):
        # First check if the user is a valid management user
        if not IsManagementUser().has_permission(request, view):
            return False

        # Superusers bypass specific permission checks
        if request.user.is_superuser:
            return True

        # Check if the user has ALL the required permissions via their role or direct assignment
        return request.user.has_perms(self.permissions)

# --- Pre-configured permission classes for common use cases ---

class CanViewDashboard(HasPermission):
    """Allows viewing the main management dashboard."""
    def __init__(self):
        # This permission will be created in management/models.py
        super().__init__("management.view_dashboard")

class CanManageEmployees(BasePermission):
    """Allows viewing, adding, changing, or deleting employee profiles."""
    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.is_staff):
            return False
        if user.is_superuser:
            return True

        # Check for specific permissions based on the request method (action)
        if view.action in ['list', 'retrieve']:
            return user.has_perm("management.view_employeeprofile")
        elif view.action == 'create':
            return user.has_perm("management.add_employeeprofile")
        elif view.action in ['update', 'partial_update', 'activate', 'deactivate']:
            return user.has_perm("management.change_employeeprofile")
        elif view.action == 'destroy':
            return user.has_perm("management.delete_employeeprofile")
        return False

class CanViewFinancialReports(HasPermission):
    """Allows viewing financial reports like P&L and Balance Sheet."""
    def __init__(self):
        # This permission will be created in accounting/models.py
        super().__init__("accounting.view_financial_reports")
