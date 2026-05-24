from django.test import TestCase
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from users.models import User
from notices.models import Notice, Comment, Like


class NoticeTests(APITestCase):
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
        )
        self.notice = Notice.objects.create(
            title="Test Notice",
            description="Test description",
            category="campus_life",
            priority="normal",
            created_by=self.student,
        )
    
    def test_create_notice_as_student(self):
        client = APIClient()
        client.force_authenticate(user=self.student)
        url = "/api/v1/notices/"
        response = client.post(url, {
            "title": "New Notice",
            "description": "New description",
            "category": "campus_life",
            "priority": "normal",
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_like_notice(self):
        client = APIClient()
        client.force_authenticate(user=self.student)
        url = f"/api/v1/notices/{self.notice.id}/like/"
        response = client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(Like.objects.filter(notice=self.notice, user=self.student).exists())
    
    def test_comment_on_notice(self):
        client = APIClient()
        client.force_authenticate(user=self.student)
        url = f"/api/v1/notices/{self.notice.id}/comments/"
        response = client.post(url, {"text": "Great notice!"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Comment.objects.filter(notice=self.notice, user=self.student).exists())
    
    def test_search_notices(self):
        client = APIClient()
        client.force_authenticate(user=self.student)
        url = "/api/v1/notices/search/?q=Test"
        response = client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data["results"]) > 0)


class NoticePermissionsTests(APITestCase):
    def setUp(self):
        self.student1 = User.objects.create_user(
            username="student1",
            email="s1@bugema.ac.ug",
            password="pass123",
            designation="student",
        )
        self.student2 = User.objects.create_user(
            username="student2",
            email="s2@bugema.ac.ug",
            password="pass123",
            designation="student",
        )
        self.notice = Notice.objects.create(
            title="Test Notice",
            description="Test description",
            category="campus_life",
            created_by=self.student1,
        )
    
    def test_student_cannot_edit_others_notice(self):
        client = APIClient()
        client.force_authenticate(user=self.student2)
        url = f"/api/v1/notices/{self.notice.id}/"
        response = client.patch(url, {"title": "Hacked!"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_owner_can_edit_notice(self):
        client = APIClient()
        client.force_authenticate(user=self.student1)
        url = f"/api/v1/notices/{self.notice.id}/"
        response = client.patch(url, {"title": "Updated Title"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.notice.refresh_from_db()
        self.assertEqual(self.notice.title, "Updated Title")
