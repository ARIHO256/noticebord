import pytest
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from events.models import Event, RSVP, Attendance

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="testuser", email="test@bugema.ac.ug", password="testpass123"
    )


@pytest.fixture
def staff_user(db):
    return User.objects.create_user(
        username="staffuser", email="staff@bugema.ac.ug", password="testpass123", is_staff=True
    )


@pytest.fixture
def event(db, user):
    return Event.objects.create(
        title="Test Event",
        description="A test event",
        event_type=Event.EventType.SOCIAL,
        start_time=timezone.now() + timedelta(days=1),
        end_time=timezone.now() + timedelta(days=1, hours=2),
        location="Main Hall",
        created_by=user,
    )


@pytest.mark.django_db
class TestEventAPI:
    def test_list_events(self, api_client, user, event):
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/v1/events/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_create_event(self, api_client, user):
        api_client.force_authenticate(user=user)
        payload = {
            "title": "New Event",
            "description": "Description",
            "event_type": "social",
            "start_time": (timezone.now() + timedelta(days=1)).isoformat(),
            "end_time": (timezone.now() + timedelta(days=1, hours=2)).isoformat(),
            "location": "Library",
        }
        response = api_client.post("/api/v1/events/", payload, format="json")
        assert response.status_code == status.HTTP_201_OK
        assert response.data["title"] == "New Event"

    def test_rsvp_event(self, api_client, user, event):
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/v1/events/{event.id}/rsvp/", {"status": "going"}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert RSVP.objects.filter(event=event, user=user).exists()

    def test_cancel_rsvp(self, api_client, user, event):
        RSVP.objects.create(event=event, user=user, status=RSVP.STATUS_GOING)
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/v1/events/{event.id}/cancel-rsvp/")
        assert response.status_code == status.HTTP_200_OK
        assert not RSVP.objects.filter(event=event, user=user).exists()

    def test_check_in_event(self, api_client, user, event):
        from events.models import EventCheckIn
        RSVP.objects.create(event=event, user=user, status=RSVP.STATUS_GOING)
        check_in = EventCheckIn.objects.create(event=event)
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/v1/events/{event.id}/check-in/", {"code": str(check_in.code)}, format="json")
        assert response.status_code == status.HTTP_200_OK
        assert Attendance.objects.filter(event=event, user=user).exists()

    def test_export_ics(self, api_client, user, event):
        api_client.force_authenticate(user=user)
        response = api_client.get(f"/api/v1/events/{event.id}/export-ics/")
        assert response.status_code == status.HTTP_200_OK
        assert response["Content-Type"] == "text/calendar"


@pytest.mark.django_db
class TestEventModel:
    def test_event_str(self, event):
        assert str(event) == "Test Event"

    def test_attendees_count(self, event, user):
        assert event.attendees_count == 0
        RSVP.objects.create(event=event, user=user, status=RSVP.STATUS_GOING)
        assert event.attendees_count == 1

    def test_is_full(self, event, user):
        event.max_attendees = 1
        event.save()
        assert not event.is_full
        RSVP.objects.create(event=event, user=user, status=RSVP.STATUS_GOING)
        assert event.is_full
