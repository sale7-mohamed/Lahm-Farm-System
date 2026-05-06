from rest_framework.permissions import BasePermission, SAFE_METHODS

class ReadOnlyOrIsAuthenticated(BasePermission):
    """
       (GET, HEAD, OPTIONS)
        .
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_authenticated)

class IsAdminOrReadOnly(BasePermission):
    """
           (is_staff=True).
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)

