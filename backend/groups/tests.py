import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from groups.models import Group, GroupMembership, GroupMessage

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="testuser", email="test@bugema.ac.ug", password="testpass123")


@pytest.fixture
def group(db, user):
    g = Group.objects.create(name="Test Group", description="A test group", created_by=user)
    GroupMembership.objects.create(group=g, user=user, role=GroupMembership.Role.ADMIN)
    return g


@pytest.mark.django_db
class TestGroupAPI:
    def test_list_groups(self, api_client, user, group):
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/v1/groups/")
        assert response.status_code == status.HTTP_200_OK

    def test_join_group(self, api_client, user, group):
        other = User.objects.create_user(username="other", email="other@bugema.ac.ug", password="pass")
        api_client.force_authenticate(user=other)
        response = api_client.post(f"/api/v1/groups/{group.id}/join/")
        assert response.status_code == status.HTTP_200_OK
        assert GroupMembership.objects.filter(group=group, user=other, is_active=True).exists()

    def test_leave_group(self, api_client, user, group):
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/v1/groups/{group.id}/leave/")
        assert response.status_code == status.HTTP_200_OK

    def test_send_group_message(self, api_client, user, group):
        api_client.force_authenticate(user=user)
        response = api_client.post(f"/api/v1/groups/{group.id}/send-message/", {"content": "Hello group!"}, format="json")
        assert response.status_code == status.HTTP_201_CREATED
        assert GroupMessage.objects.filter(group=group, content="Hello group!").exists()


@pytest.mark.django_db
class TestGroupModel:
    def test_group_str(self, group):
        assert str(group) == "Test Group"

    def test_member_count(self, group, user):
        assert group.member_count == 1
        other = User.objects.create_user(username="other2", email="o2@bugema.ac.ug", password="pass")
        GroupMembership.objects.create(group=group, user=other, role=GroupMembership.Role.MEMBER)
        assert group.member_count == 2
