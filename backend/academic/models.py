from django.conf import settings
from django.db import models


class AcademicCalendar(models.Model):
    class EventCategory(models.TextChoices):
        REGISTRATION = "registration", "Registration"
        EXAMINATION = "examination", "Examination"
        HOLIDAY = "holiday", "Holiday"
        ORIENTATION = "orientation", "Orientation"
        GRADUATION = "graduation", "Graduation"
        DEADLINE = "deadline", "Deadline"
        OTHER = "other", "Other"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=20, choices=EventCategory.choices, default=EventCategory.OTHER)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    academic_year = models.CharField(max_length=20, blank=True)
    semester = models.CharField(max_length=20, blank=True)
    is_important = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date"]
        indexes = [
            models.Index(fields=["start_date"]),
            models.Index(fields=["category"]),
            models.Index(fields=["academic_year"]),
        ]

    def __str__(self):
        return self.title


class Course(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    department = models.CharField(max_length=100, blank=True)
    school = models.CharField(max_length=150, blank=True)
    credit_hours = models.PositiveIntegerField(default=3)
    lecturer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="teaching_courses",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.name}"


class ExamTimetable(models.Model):
    class ExamType(models.TextChoices):
        MIDTERM = "midterm", "Midterm"
        FINAL = "final", "Final"
        QUIZ = "quiz", "Quiz"
        SUPPLEMENTARY = "supplementary", "Supplementary"

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="exams")
    exam_type = models.CharField(max_length=20, choices=ExamType.choices, default=ExamType.FINAL)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    venue = models.CharField(max_length=255, blank=True)
    invigilators = models.CharField(max_length=500, blank=True)
    instructions = models.TextField(blank=True)
    academic_year = models.CharField(max_length=20, blank=True)
    semester = models.CharField(max_length=20, blank=True)
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["date", "start_time"]
        indexes = [
            models.Index(fields=["date"]),
            models.Index(fields=["exam_type"]),
            models.Index(fields=["academic_year", "semester"]),
        ]

    def __str__(self):
        return f"{self.course.code} {self.get_exam_type_display()} - {self.date}"


class Assignment(models.Model):
    class AssignmentType(models.TextChoices):
        INDIVIDUAL = "individual", "Individual"
        GROUP = "group", "Group"
        PROJECT = "project", "Project"
        QUIZ = "quiz", "Quiz"
        OTHER = "other", "Other"

    title = models.CharField(max_length=200)
    description = models.TextField()
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="assignments", null=True, blank=True)
    assignment_type = models.CharField(max_length=20, choices=AssignmentType.choices, default=AssignmentType.INDIVIDUAL)
    due_date = models.DateTimeField()
    max_score = models.PositiveIntegerField(default=100)
    attachment = models.FileField(upload_to="assignments/", blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_assignments",
    )
    is_published = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date"]

    def __str__(self):
        return self.title


class StudentCourse(models.Model):
    """Enrollment of a student in a course."""
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="enrolled_courses",
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="enrolled_students")
    academic_year = models.CharField(max_length=20, blank=True)
    semester = models.CharField(max_length=20, blank=True)
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "course", "academic_year", "semester")


class Grade(models.Model):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="grades",
    )
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="grades")
    exam = models.ForeignKey(ExamTimetable, on_delete=models.SET_NULL, null=True, blank=True, related_name="grades")
    assignment = models.ForeignKey(Assignment, on_delete=models.SET_NULL, null=True, blank=True, related_name="grades")
    score = models.DecimalField(max_digits=5, decimal_places=2)
    max_score = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    remarks = models.CharField(max_length=255, blank=True)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="graded_scores",
    )
    graded_at = models.DateTimeField(auto_now_add=True)
    is_published = models.BooleanField(default=False)

    class Meta:
        ordering = ["-graded_at"]

    @property
    def percentage(self):
        if self.max_score and self.max_score > 0:
            return round((float(self.score) / float(self.max_score)) * 100, 2)
        return 0

    @property
    def grade_letter(self):
        pct = self.percentage
        if pct >= 80:
            return "A"
        elif pct >= 75:
            return "B+"
        elif pct >= 70:
            return "B"
        elif pct >= 65:
            return "C+"
        elif pct >= 60:
            return "C"
        elif pct >= 55:
            return "D+"
        elif pct >= 50:
            return "D"
        elif pct >= 45:
            return "E"
        else:
            return "F"
