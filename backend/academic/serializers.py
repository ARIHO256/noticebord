from rest_framework import serializers
from users.serializers import MiniUserSerializer
from .models import (
    AcademicCalendar,
    Course,
    ExamTimetable,
    Assignment,
    StudentCourse,
    Grade,
)


class AcademicCalendarSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicCalendar
        fields = [
            "id", "title", "description", "category",
            "start_date", "end_date", "academic_year", "semester",
            "is_important", "created_at", "updated_at",
        ]


class CourseSerializer(serializers.ModelSerializer):
    lecturer = MiniUserSerializer(read_only=True)
    lecturer_id = serializers.PrimaryKeyRelatedField(
        source="lecturer",
        queryset=Course._meta.get_field("lecturer").related_model.objects.all(),
        write_only=True,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Course
        fields = [
            "id", "code", "name", "description", "department", "school",
            "credit_hours", "lecturer", "lecturer_id", "is_active", "created_at",
        ]


class ExamTimetableSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(
        source="course", queryset=Course.objects.all(), write_only=True
    )

    class Meta:
        model = ExamTimetable
        fields = [
            "id", "course", "course_id", "exam_type", "date", "start_time", "end_time",
            "venue", "invigilators", "instructions", "academic_year", "semester",
            "is_published", "created_at",
        ]


class AssignmentSerializer(serializers.ModelSerializer):
    course = CourseSerializer(read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(
        source="course", queryset=Course.objects.all(), write_only=True, required=False, allow_null=True
    )
    created_by = MiniUserSerializer(read_only=True)

    class Meta:
        model = Assignment
        fields = [
            "id", "title", "description", "course", "course_id", "assignment_type",
            "due_date", "max_score", "attachment", "created_by", "is_published", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]


class StudentCourseSerializer(serializers.ModelSerializer):
    student = MiniUserSerializer(read_only=True)
    course = CourseSerializer(read_only=True)
    course_id = serializers.PrimaryKeyRelatedField(
        source="course", queryset=Course.objects.all(), write_only=True
    )

    class Meta:
        model = StudentCourse
        fields = ["id", "student", "course", "course_id", "academic_year", "semester", "enrolled_at"]
        read_only_fields = ["id", "student", "enrolled_at"]


class GradeSerializer(serializers.ModelSerializer):
    student = MiniUserSerializer(read_only=True)
    course = CourseSerializer(read_only=True)
    percentage = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    grade_letter = serializers.CharField(read_only=True)

    class Meta:
        model = Grade
        fields = [
            "id", "student", "course", "exam", "assignment",
            "score", "max_score", "percentage", "grade_letter",
            "remarks", "graded_by", "graded_at", "is_published",
        ]
        read_only_fields = ["id", "graded_by", "graded_at"]
