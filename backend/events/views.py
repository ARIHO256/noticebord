from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from common.permissions import IsOwnerOrReadOnly, IsAdminUser
from notifications.services import notify_event_rsvp, notify_event_reminder
from .models import Event, RSVP, Attendance, EventAnnouncement, EventCheckIn
from .serializers import (
    EventListSerializer,
    EventDetailSerializer,
    RSVPSerializer,
    AttendanceSerializer,
    EventAnnouncementSerializer,
)
from .ical import event_ics_response


class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.filter(is_active=True)
    serializer_class = EventListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["event_type", "status", "department", "school", "is_featured"]
    search_fields = ["title", "description", "location"]
    ordering_fields = ["start_time", "created_at", "title"]
    ordering = ["-start_time"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return EventDetailSerializer
        return EventListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        now = timezone.now()
        status_filter = self.request.query_params.get("time_filter")
        if status_filter == "upcoming":
            qs = qs.filter(start_time__gte=now)
        elif status_filter == "past":
            qs = qs.filter(end_time__lt=now)
        elif status_filter == "ongoing":
            qs = qs.filter(start_time__lte=now, end_time__gte=now)
        return qs.annotate(attendees_count=Count("rsvps", filter=Q(rsvps__status=RSVP.STATUS_GOING)))

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="rsvp")
    def rsvp(self, request, pk=None):
        event = self.get_object()
        status_choice = request.data.get("status", RSVP.STATUS_GOING)
        if event.is_full and status_choice == RSVP.STATUS_GOING:
            return Response({"detail": "Event is full."}, status=status.HTTP_400_BAD_REQUEST)
        rsvp, created = RSVP.objects.update_or_create(
            event=event,
            user=request.user,
            defaults={"status": status_choice, "notes": request.data.get("notes", "")},
        )
        if created and status_choice == RSVP.STATUS_GOING:
            notify_event_rsvp(event, request.user)
        return Response(RSVPSerializer(rsvp).data)

    @action(detail=True, methods=["post"], url_path="cancel-rsvp")
    def cancel_rsvp(self, request, pk=None):
        event = self.get_object()
        RSVP.objects.filter(event=event, user=request.user).delete()
        return Response({"detail": "RSVP cancelled."})

    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        event = self.get_object()
        code = request.data.get("code")
        try:
            check_in = EventCheckIn.objects.get(event=event, code=code, is_active=True)
        except EventCheckIn.DoesNotExist:
            return Response({"detail": "Invalid check-in code."}, status=status.HTTP_400_BAD_REQUEST)

        attendance, created = Attendance.objects.get_or_create(
            event=event,
            user=request.user,
            defaults={"method": "qr"},
        )
        return Response(AttendanceSerializer(attendance).data)

    @action(detail=True, methods=["get"], url_path="attendees")
    def attendees(self, request, pk=None):
        event = self.get_object()
        qs = Attendance.objects.filter(event=event)
        serializer = AttendanceSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="announce")
    def announce(self, request, pk=None):
        event = self.get_object()
        if event.created_by != request.user and not request.user.is_staff:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        serializer = EventAnnouncementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(event=event, sent_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="announcements")
    def announcements(self, request, pk=None):
        event = self.get_object()
        qs = EventAnnouncement.objects.filter(event=event)
        serializer = EventAnnouncementSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="featured")
    def featured(self, request):
        qs = self.get_queryset().filter(is_featured=True, start_time__gte=timezone.now())[:10]
        serializer = EventListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="my-events")
    def my_events(self, request):
        going_ids = RSVP.objects.filter(user=request.user, status=RSVP.STATUS_GOING).values_list("event_id", flat=True)
        qs = self.get_queryset().filter(id__in=going_ids)
        serializer = EventListSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="export-ics")
    def export_ics(self, request, pk=None):
        event = self.get_object()
        return event_ics_response(event)


class RSVPViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RSVPSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RSVP.objects.filter(user=self.request.user)
