from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AcademicCalendarViewSet,
    CourseViewSet,
    ExamTimetableViewSet,
    AssignmentViewSet,
    StudentCourseViewSet,
    GradeViewSet,
)

router = DefaultRouter()
router.register(r"calendar", AcademicCalendarViewSet, basename="academic-calendar")
router.register(r"courses", CourseViewSet, basename="courses")
router.register(r"exams", ExamTimetableViewSet, basename="exams")
router.register(r"assignments", AssignmentViewSet, basename="assignments")
router.register(r"enrollments", StudentCourseViewSet, basename="enrollments")
router.register(r"grades", GradeViewSet, basename="grades")

urlpatterns = [
    path("", include(router.urls)),
]
