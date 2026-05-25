import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from campus.models import StaffDirectory, LostFound, EmergencyContact, Venue

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="testuser", email="test@bugema.ac.ug", password="testpass123")


@pytest.fixture
def staff_member(db):
    return StaffDirectory.objects.create(
        name="Dr. Test",
        staff_type=StaffDirectory.StaffType.FACULTY,
        title="Senior Lecturer",
        department="Computer Science",
        phone="+256700000000",
        email="dr.test@bugema.ac.ug",
    )


@pytest.mark.django_db
class TestCampusAPI:
    def test_staff_directory_list(self, api_client, user, staff_member):
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/v1/campus/staff/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_lost_found_list(self, api_client, user):
        LostFound.objects.create(title="Lost Phone", description="iPhone 14", item_type=LostFound.ItemStatus.LOST, reported_by=user)
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/v1/campus/lost-found/")
        assert response.status_code == status.HTTP_200_OK

    def test_emergency_contacts_list(self, api_client, user):
        EmergencyContact.objects.create(name="Security", contact_type=EmergencyContact.ContactType.SECURITY, phone="+256700111111")
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/v1/campus/emergency-contacts/")
        assert response.status_code == status.HTTP_200_OK

    def test_venues_list(self, api_client, user):
        Venue.objects.create(name="Main Hall", capacity=500)
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/v1/campus/venues/")
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestCampusModel:
    def test_staff_str(self, staff_member):
        assert str(staff_member) == "Dr. Test (Faculty)"

    def test_lostfound_str(self, user):
        item = LostFound.objects.create(title="Lost Keys", description="Car keys", item_type=LostFound.ItemStatus.LOST, reported_by=user)
        assert "Lost" in str(item)
