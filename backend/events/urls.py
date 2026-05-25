from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EventViewSet, RSVPViewSet

router = DefaultRouter()
router.register(r"", EventViewSet, basename="events")
router.register(r"rsvps", RSVPViewSet, basename="rsvps")

urlpatterns = [
    path("", include(router.urls)),
]
