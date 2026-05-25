from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    StaffDirectoryViewSet,
    LostFoundViewSet,
    VenueViewSet,
    VenueBookingViewSet,
    EmergencyContactViewSet,
    EmergencyAlertViewSet,
)

router = DefaultRouter()
router.register(r"staff", StaffDirectoryViewSet, basename="staff-directory")
router.register(r"lost-found", LostFoundViewSet, basename="lost-found")
router.register(r"venues", VenueViewSet, basename="venues")
router.register(r"venue-bookings", VenueBookingViewSet, basename="venue-bookings")
router.register(r"emergency-contacts", EmergencyContactViewSet, basename="emergency-contacts")
router.register(r"emergency-alerts", EmergencyAlertViewSet, basename="emergency-alerts")

urlpatterns = [
    path("", include(router.urls)),
]
