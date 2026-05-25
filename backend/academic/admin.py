from django.contrib import admin
from .models import AcademicCalendar, Course, ExamTimetable, Assignment, StudentCourse, Grade


@admin.register(AcademicCalendar)
class AcademicCalendarAdmin(admin.ModelAdmin):
    list_display = ["title", "category", "start_date", "end_date", "academic_year", "is_important"]
    list_filter = ["category", "is_important"]
    date_hierarchy = "start_date"


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "department", "credit_hours", "lecturer", "is_active"]
    list_filter = ["department", "is_active"]
    search_fields = ["code", "name"]


@admin.register(ExamTimetable)
class ExamTimetableAdmin(admin.ModelAdmin):
    list_display = ["course", "exam_type", "date", "start_time", "venue", "is_published"]
    list_filter = ["exam_type", "is_published"]
    date_hierarchy = "date"


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ["title", "course", "assignment_type", "due_date", "is_published"]
    list_filter = ["assignment_type", "is_published"]


@admin.register(StudentCourse)
class StudentCourseAdmin(admin.ModelAdmin):
    list_display = ["student", "course", "academic_year", "semester"]
    list_filter = ["academic_year", "semester"]


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ["student", "course", "score", "max_score", "grade_letter", "is_published"]
    list_filter = ["is_published"]
