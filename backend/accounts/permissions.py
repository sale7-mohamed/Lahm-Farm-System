# accounts/permissions.py
#  FIX: Import SAFE_METHODS along with BasePermission
from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import User as CustomerUser

class IsCustomerUser(BasePermission):
    """
    Allows access only to authenticated customer users.
    Checks if the request.user is an instance of the customer User model.
    """
    def has_permission(self, request, view):
        # The user must be authenticated, and must be an instance 
        # of the CustomerUser model, not the Employee model.
        return bool(
            request.user and
            request.user.is_authenticated and
            isinstance(request.user, CustomerUser)
        )

class IsPhoneVerified(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_phone_verified)

class IsAdminOrSeller(BasePermission):
    def has_permission(self, request, view):
        # The corrected import above makes this line valid now
        if request.method in SAFE_METHODS:
            return True
        u = request.user
        return bool(u and u.is_authenticated and (u.is_superuser or u.role == 'seller'))
