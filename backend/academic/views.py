from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import AcademicCalendar, Course, ExamTimetable, Assignment, StudentCourse, Grade
from .serializers import (
    AcademicCalendarSerializer,
    CourseSerializer,
    ExamTimetableSerializer,
    AssignmentSerializer,
    StudentCourseSerializer,
    GradeSerializer,
)


class AcademicCalendarViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AcademicCalendar.objects.all()
    serializer_class = AcademicCalendarSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["category", "academic_year", "semester", "is_important"]
    search_fields = ["title", "description"]
    ordering_fields = ["start_date", "created_at"]
    ordering = ["-start_date"]


class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Course.objects.filter(is_active=True)
    serializer_class = CourseSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["department", "school"]
    search_fields = ["code", "name", "description"]
    ordering = ["code"]


class ExamTimetableViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ExamTimetable.objects.filter(is_published=True)
    serializer_class = ExamTimetableSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["exam_type", "academic_year", "semester"]
    ordering = ["date", "start_time"]


class AssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssignmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["assignment_type", "course"]
    search_fields = ["title", "description"]
    ordering = ["due_date"]

    def get_queryset(self):
        if self.request.user.is_staff or self.request.user.is_faculty:
            return Assignment.objects.all()
        # Students see published assignments for their enrolled courses
        enrolled_course_ids = StudentCourse.objects.filter(
            student=self.request.user
        ).values_list("course_id", flat=True)
        return Assignment.objects.filter(is_published=True, course_id__in=enrolled_course_ids)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class StudentCourseViewSet(viewsets.ModelViewSet):
    serializer_class = StudentCourseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return StudentCourse.objects.filter(student=self.request.user)

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)


class GradeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = GradeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ["course"]
    ordering = ["-graded_at"]

    def get_queryset(self):
        if self.request.user.is_staff or self.request.user.is_faculty:
            # Staff/faculty can view grades they graded or all if superuser
            if self.request.user.is_superuser:
                return Grade.objects.all()
            return Grade.objects.filter(graded_by=self.request.user)
        # Students only see their own published grades
        return Grade.objects.filter(student=self.request.user, is_published=True)

    @action(detail=False, methods=["get"], url_path="my-grades")
    def my_grades(self, request):
        qs = Grade.objects.filter(student=request.user, is_published=True)
        serializer = GradeSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="my-gpa")
    def my_gpa(self, request):
        grades = Grade.objects.filter(student=request.user, is_published=True)
        total_points = 0
        total_credits = 0
        for grade in grades:
            credit_hours = grade.course.credit_hours or 3
            letter = grade.grade_letter
            points = {"A": 5, "B+": 4.5, "B": 4, "C+": 3.5, "C": 3, "D+": 2.5, "D": 2, "E": 1, "F": 0}.get(letter, 0)
            total_points += points * credit_hours
            total_credits += credit_hours
        gpa = round(total_points / total_credits, 2) if total_credits > 0 else 0
        return Response({"gpa": gpa, "total_credits": total_credits, "grade_count": grades.count()})
