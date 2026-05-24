from django.db import connections
from django.core.cache import cache
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status


class HealthCheckView(APIView):
    """Health check endpoint for load balancers and monitoring."""
    permission_classes = []
    authentication_classes = []

    def get(self, request):
        checks = {
            "status": "healthy",
            "database": self._check_database(),
            "cache": self._check_cache(),
            "timestamp": timezone.now().isoformat(),
        }
        
        if not all([checks["database"]["ok"], checks["cache"]["ok"]]):
            checks["status"] = "unhealthy"
            return Response(checks, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        
        return Response(checks)

    def _check_database(self):
        try:
            connections["default"].cursor().execute("SELECT 1")
            return {"ok": True, "message": "Database connection OK"}
        except Exception as e:
            return {"ok": False, "message": str(e)}

    def _check_cache(self):
        try:
            cache.set("health_check", "ok", 10)
            value = cache.get("health_check")
            if value == "ok":
                return {"ok": True, "message": "Cache connection OK"}
            return {"ok": False, "message": "Cache read/write failed"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
