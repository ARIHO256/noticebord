from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """Allow access only to admin users."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_staff)


class IsSuperUser(permissions.BasePermission):
    """Allow access only to superusers."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_superuser)


class ReadOnly(permissions.BasePermission):
    """Allow only safe methods."""

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS
