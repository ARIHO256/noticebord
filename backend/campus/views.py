from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import (
    StaffDirectory,
    LostFound,
    Venue,
    VenueBooking,
    EmergencyContact,
    EmergencyAlert,
    EmergencyAlertAcknowledgment,
)
from .serializers import (
    StaffDirectorySerializer,
    LostFoundSerializer,
    VenueSerializer,
    VenueBookingSerializer,
    EmergencyContactSerializer,
    EmergencyAlertSerializer,
    EmergencyAlertAcknowledgmentSerializer,
)


class StaffDirectoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StaffDirectory.objects.filter(is_active=True)
    serializer_class = StaffDirectorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["staff_type", "department", "school"]
    search_fields = ["name", "title", "department", "bio"]
    ordering_fields = ["display_order", "name"]
    ordering = ["display_order", "name"]


class LostFoundViewSet(viewsets.ModelViewSet):
    queryset = LostFound.objects.filter(is_active=True)
    serializer_class = LostFoundSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["item_type", "category", "status"]
    search_fields = ["title", "description", "location_lost_found"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        my_reports = self.request.query_params.get("my_reports")
        if my_reports == "1":
            qs = qs.filter(reported_by=self.request.user)
        return qs

    def perform_create(self, serializer):
        serializer.save(reported_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="claim")
    def claim(self, request, pk=None):
        item = self.get_object()
        if item.status != LostFound.ItemStatus.FOUND:
            return Response({"detail": "Only found items can be claimed."}, status=status.HTTP_400_BAD_REQUEST)
        item.claimed_by = request.user
        item.claim_notes = request.data.get("notes", "")
        item.status = LostFound.ItemStatus.CLAIMED
        item.save(update_fields=["claimed_by", "claim_notes", "status", "updated_at"])
        return Response(LostFoundSerializer(item, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="verify-claim")
    def verify_claim(self, request, pk=None):
        item = self.get_object()
        if not request.user.is_staff:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        item.status = LostFound.ItemStatus.RETURNED
        item.claim_verified_by = request.user
        item.save(update_fields=["status", "claim_verified_by", "updated_at"])
        return Response(LostFoundSerializer(item, context={"request": request}).data)


class VenueViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Venue.objects.filter(is_active=True)
    serializer_class = VenueSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ["name", "location"]
    ordering = ["name"]

    @action(detail=True, methods=["get"], url_path="availability")
    def availability(self, request, pk=None):
        venue = self.get_object()
        date = request.query_params.get("date")
        if not date:
            return Response({"detail": "Date parameter required."}, status=status.HTTP_400_BAD_REQUEST)
        bookings = VenueBooking.objects.filter(
            venue=venue,
            start_time__date=date,
            status__in=[VenueBooking.BookingStatus.PENDING, VenueBooking.BookingStatus.APPROVED],
        )
        return Response({
            "venue": VenueSerializer(venue, context={"request": request}).data,
            "bookings": VenueBookingSerializer(bookings, many=True, context={"request": request}).data,
        })


class VenueBookingViewSet(viewsets.ModelViewSet):
    serializer_class = VenueBookingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["status", "venue"]
    ordering = ["-created_at"]

    def get_queryset(self):
        if self.request.user.is_staff:
            return VenueBooking.objects.all()
        return VenueBooking.objects.filter(booked_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(booked_by=self.request.user, status=VenueBooking.BookingStatus.PENDING)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        booking = self.get_object()
        if not request.user.is_staff:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        # Check conflicts
        conflicts = VenueBooking.objects.filter(
            venue=booking.venue,
            status=VenueBooking.BookingStatus.APPROVED,
            start_time__lt=booking.end_time,
            end_time__gt=booking.start_time,
        ).exclude(pk=booking.pk)
        if conflicts.exists():
            return Response({"detail": "Conflicting booking exists."}, status=status.HTTP_400_BAD_REQUEST)
        booking.status = VenueBooking.BookingStatus.APPROVED
        booking.approved_by = request.user
        booking.approved_at = timezone.now()
        booking.save(update_fields=["status", "approved_by", "approved_at"])
        return Response(VenueBookingSerializer(booking, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        booking = self.get_object()
        if not request.user.is_staff:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        booking.status = VenueBooking.BookingStatus.REJECTED
        booking.rejection_reason = request.data.get("reason", "")
        booking.save(update_fields=["status", "rejection_reason"])
        return Response(VenueBookingSerializer(booking, context={"request": request}).data)


class EmergencyContactViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = EmergencyContact.objects.filter(is_active=True)
    serializer_class = EmergencyContactSerializer
    permission_classes = [IsAuthenticated]
    ordering = ["display_order"]


class EmergencyAlertViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = EmergencyAlert.objects.filter(is_active=True)
    serializer_class = EmergencyAlertSerializer
    permission_classes = [IsAuthenticated]
    ordering = ["-sent_at"]

    def get_queryset(self):
        qs = super().get_queryset()
        now = timezone.now()
        qs = qs.filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        return qs

    @action(detail=True, methods=["post"], url_path="acknowledge")
    def acknowledge(self, request, pk=None):
        alert = self.get_object()
        ack, created = EmergencyAlertAcknowledgment.objects.get_or_create(
            alert=alert,
            user=request.user,
            defaults={
                "location_lat": request.data.get("lat"),
                "location_lng": request.data.get("lng"),
            },
        )
        if created:
            alert.acknowledged_count += 1
            alert.save(update_fields=["acknowledged_count"])
        return Response(EmergencyAlertAcknowledgmentSerializer(ack).data)

    @action(detail=False, methods=["post"], url_path="broadcast", permission_classes=[IsAuthenticated])
    def broadcast(self, request):
        if not request.user.is_staff:
            return Response({"detail": "Staff only."}, status=status.HTTP_403_FORBIDDEN)
        serializer = EmergencyAlertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(sent_by=request.user)
        # TODO: Send push notifications to ALL users
        return Response(serializer.data, status=status.HTTP_201_CREATED)
