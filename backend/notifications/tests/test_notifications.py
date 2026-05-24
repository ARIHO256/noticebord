from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from users.models import User
from notifications.models import Notification, NotificationPreference


class NotificationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            email="test@bugema.ac.ug",
            password="pass123",
        )
        self.other_user = User.objects.create_user(
            username="other",
            email="other@bugema.ac.ug",
            password="pass123",
        )
        self.notification = Notification.objects.create(
            user=self.user,
            notification_type="notice",
            title="Test Notification",
            message="This is a test",
            sender=self.other_user,
        )
    
    def test_list_notifications(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        url = "/api/v1/notifications/"
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
    
    def test_unread_count(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        url = "/api/v1/notifications/unread-count/"
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["unread_count"], 1)
    
    def test_mark_as_read(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        url = "/api/v1/notifications/mark-read/"
        response = client.post(url, {"ids": [str(self.notification.id)]})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.notification.refresh_from_db()
        self.assertTrue(self.notification.is_read)
    
    def test_notification_preferences_created(self):
        self.assertTrue(NotificationPreference.objects.filter(user=self.user).exists())
    
    def test_update_preferences(self):
        client = APIClient()
        client.force_authenticate(user=self.user)
        url = "/api/v1/notifications/preferences/"
        response = client.put(url, {"notify_likes": False})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        prefs = NotificationPreference.objects.get(user=self.user)
        self.assertFalse(prefs.notify_likes)
