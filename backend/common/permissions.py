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


class IsOwnerOrReadOnly(permissions.BasePermission):
    """Object-level permission to only allow owners of an object to edit it."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return getattr(obj, "created_by", None) == request.user or request.user.is_staff


class IsSelfOrAdmin(permissions.BasePermission):
    """Allow users to only update their own profile (admins can override)."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj == request.user or request.user.is_staff
