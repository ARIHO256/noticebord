import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from academic.models import AcademicCalendar, Course, ExamTimetable, Assignment

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="testuser", email="test@bugema.ac.ug", password="testpass123")


@pytest.fixture
def course(db):
    return Course.objects.create(code="COS101", name="Intro to Computing", credit_hours=4)


@pytest.mark.django_db
class TestAcademicAPI:
    def test_calendar_list(self, api_client, user):
        AcademicCalendar.objects.create(title="Registration Week", start_date="2026-01-15", category=AcademicCalendar.EventCategory.REGISTRATION)
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/v1/academic/calendar/")
        assert response.status_code == status.HTTP_200_OK

    def test_courses_list(self, api_client, user, course):
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/v1/academic/courses/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_exams_list(self, api_client, user, course):
        ExamTimetable.objects.create(course=course, exam_type=ExamTimetable.ExamType.FINAL, date="2026-04-20", start_time="09:00:00", end_time="12:00:00", is_published=True)
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/v1/academic/exams/")
        assert response.status_code == status.HTTP_200_OK

    def test_assignments_list(self, api_client, user, course):
        Assignment.objects.create(title="Assignment 1", description="First assignment", course=course, due_date="2026-03-15T23:59:00Z", created_by=user, is_published=True)
        api_client.force_authenticate(user=user)
        response = api_client.get("/api/v1/academic/assignments/")
        assert response.status_code == status.HTTP_200_OK


@pytest.mark.django_db
class TestAcademicModel:
    def test_course_str(self, course):
        assert str(course) == "COS101 - Intro to Computing"

    def test_exam_str(self, course):
        exam = ExamTimetable.objects.create(course=course, exam_type=ExamTimetable.ExamType.MIDTERM, date="2026-03-10", start_time="14:00:00", end_time="16:00:00")
        assert "COS101 Midterm" in str(exam)
