from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from django.contrib.auth import views as auth_views

from users.views import EmailTokenObtainPairView


def health_check(request):
    """Health check endpoint for load balancers."""
    from django.db import connection
    from django.core.cache import cache
    from django.utils import timezone
    
    health = {
        "status": "healthy",
        "database": "unknown",
        "cache": "unknown",
        "timestamp": timezone.now().isoformat(),
    }
    
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        health["database"] = "connected"
    except Exception as e:
        health["database"] = f"error: {str(e)}"
        health["status"] = "unhealthy"
    
    try:
        cache.set("health_check", "ok", timeout=5)
        if cache.get("health_check") == "ok":
            health["cache"] = "connected"
        else:
            health["cache"] = "disconnected"
    except Exception as e:
        health["cache"] = f"error: {str(e)}"
    
    status_code = 200 if health["status"] == "healthy" else 503
    return JsonResponse(health, status=status_code)


def ready_check(request):
    """Readiness check for Kubernetes."""
    return JsonResponse({"ready": True})


# API v1 URLs
api_v1_patterns = [
    path("auth/token/", EmailTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    
    # Password reset
    path(
        "auth/password-reset/",
        auth_views.PasswordResetView.as_view(
            template_name="password_reset.html",
            email_template_name="password_reset_email.html",
        ),
        name="password_reset",
    ),
    path(
        "auth/password-reset/done/",
        auth_views.PasswordResetDoneView.as_view(template_name="password_reset_done.html"),
        name="password_reset_done",
    ),
    path(
        "auth/password-reset-confirm/<uidb64>/<token>/",
        auth_views.PasswordResetConfirmView.as_view(template_name="password_reset_confirm.html"),
        name="password_reset_confirm",
    ),
    path(
        "auth/password-reset-complete/",
        auth_views.PasswordResetCompleteView.as_view(template_name="password_reset_complete.html"),
        name="password_reset_complete",
    ),
    
    path("users/", include("users.urls")),
    path("notices/", include("notices.urls")),
    path("messages/", include("messaging.urls")),
    path("moderation/", include("moderation.urls")),
    path("notifications/", include("notifications.urls")),
    path("audit/", include("audit.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health_check, name="health_check"),
    path("ready/", ready_check, name="ready_check"),
    path("api/v1/", include(api_v1_patterns)),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
