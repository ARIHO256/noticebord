from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from users.models import User
from audit.models import AuditLog, DataExportRequest, DataDeletionRequest


class AuditLogTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="admin",
            email="admin@bugema.ac.ug",
            password="pass123",
        )
        self.student = User.objects.create_user(
            username="student",
            email="student@bugema.ac.ug",
            password="pass123",
        )
    
    def test_audit_log_created_on_suspend(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)
        url = f"/api/v1/users/profiles/{self.student.id}/suspend/"
        response = client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        log = AuditLog.objects.filter(
            action="suspend",
            target_type="users.User",
            target_id=str(self.student.id),
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.actor, self.admin)
    
    def test_student_cannot_view_audit_logs(self):
        client = APIClient()
        client.force_authenticate(user=self.student)
        url = "/api/v1/audit/logs/"
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_admin_can_view_audit_logs(self):
        client = APIClient()
        client.force_authenticate(user=self.admin)
        url = "/api/v1/audit/logs/"
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class GDPRTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@bugema.ac.ug",
            password="pass123",
        )
    
    def test_request_data_export(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        url = "/api/v1/audit/data-export/"
        response = client.post(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(DataExportRequest.objects.filter(user=self.user).exists())
    
    def test_request_data_deletion(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        url = "/api/v1/audit/data-delete/"
        response = client.post(url, {"reason": "I want to leave"})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(DataDeletionRequest.objects.filter(user=self.user).exists())
