from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from users.models import User


class AuthenticationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="teststudent",
            email="test@bugema.ac.ug",
            password="testpass123",
            designation="student",
        )
    
    def test_login_with_username(self):
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {
            "username": "teststudent",
            "password": "testpass123",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
    
    def test_login_with_email(self):
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {
            "email": "test@bugema.ac.ug",
            "password": "testpass123",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
    
    def test_login_invalid_credentials(self):
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {
            "username": "teststudent",
            "password": "wrongpassword",
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_token_refresh(self):
        url = reverse("token_obtain_pair")
        response = self.client.post(url, {
            "username": "teststudent",
            "password": "testpass123",
        })
        refresh_token = response.data["refresh"]
        
        url = reverse("token_refresh")
        response = self.client.post(url, {"refresh": refresh_token})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)


class RegistrationTests(APITestCase):
    def test_student_registration(self):
        url = reverse("register-register")
        response = self.client.post(url, {
            "username": "newstudent",
            "email": "new@bugema.ac.ug",
            "password": "newpass123",
            "first_name": "New",
            "last_name": "Student",
            "school": "School of Science",
            "department": "Computer Science",
            "course": "BSc CS",
            "academic_year": "2025",
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(User.objects.filter(username="newstudent").exists())
        user = User.objects.get(username="newstudent")
        self.assertFalse(user.email_verified)
        self.assertTrue(user.email_verification_token)
