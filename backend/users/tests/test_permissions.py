from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from users.models import User


class UserPermissionsTests(APITestCase):
    def setUp(self):
        self.student = User.objects.create_user(
            username="student",
            email="student@bugema.ac.ug",
            password="pass123",
            designation="student",
        )
        self.staff = User.objects.create_user(
            username="staff",
            email="staff@bugema.ac.ug",
            password="pass123",
            designation="lecturer",
            is_staff=True,
            is_faculty=True,
        )
        self.admin = User.objects.create_superuser(
            username="admin",
            email="admin@bugema.ac.ug",
            password="pass123",
        )
    
    def test_student_cannot_suspend_user(self):
        client = APIClient()
        client.force_authenticate(user=self.student)
        url = f"/api/v1/users/profiles/{self.student.id}/suspend/"
        response = client.post(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_staff_can_suspend_user(self):
        client = APIClient()
        client.force_authenticate(user=self.staff)
        url = f"/api/v1/users/profiles/{self.student.id}/suspend/"
        response = client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.student.refresh_from_db()
        self.assertFalse(self.student.is_active)
    
    def test_staff_cannot_suspend_superuser(self):
        client = APIClient()
        client.force_authenticate(user=self.staff)
        url = f"/api/v1/users/profiles/{self.admin.id}/suspend/"
        response = client.post(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_admin_can_suspend_anyone(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)
        url = f"/api/v1/users/profiles/{self.staff.id}/suspend/"
        response = client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
