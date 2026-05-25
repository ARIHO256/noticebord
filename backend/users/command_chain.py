"""
Command Chain & Hierarchy System for Bugema University.

Hierarchy (top to bottom):
  Vice Chancellor (VC)
    └── Registrar (cross-cutting)
    └── Business Office (cross-cutting)
    └── Security (cross-cutting)
    └── Dean(s) [per school]
          └── Head of Department (HOD) [per department]
                └── Lecturer(s)
                      └── Student(s)

Cross-cutting roles (Registrar, Business Office, Security, Chaplain) can reach all schools.
"""
from enum import IntEnum


class CommandLevel(IntEnum):
    """Numeric hierarchy level. Higher = more authority."""
    STUDENT = 1
    LECTURER = 2
    HOD = 3
    DEAN = 4
    REGISTRAR = 5
    VICE_CHANCELLOR = 6
    BUSINESS_OFFICE = 5
    SECURITY = 5
    OTHER = 0


DESIGNATION_LEVEL_MAP = {
    "student": CommandLevel.STUDENT,
    "lecturer": CommandLevel.LECTURER,
    "hod": CommandLevel.HOD,
    "dean": CommandLevel.DEAN,
    "registrar": CommandLevel.REGISTRAR,
    "vice_chancellor": CommandLevel.VICE_CHANCELLOR,
    "business_office": CommandLevel.BUSINESS_OFFICE,
    "security": CommandLevel.SECURITY,
    "other": CommandLevel.OTHER,
}

CROSS_CUTTING_DESIGNATIONS = {
    "registrar",
    "business_office",
    "security",
    "vice_chancellor",
}


def get_command_level(user) -> CommandLevel:
    """Get the command level for a user."""
    designation = (getattr(user, "designation", "") or "").lower()
    return DESIGNATION_LEVEL_MAP.get(designation, CommandLevel.OTHER)


def is_higher_or_equal_in_chain(viewer, target) -> bool:
    """Check if viewer has equal or higher authority than target."""
    return get_command_level(viewer) >= get_command_level(target)


def can_command(viewer, target) -> bool:
    """
    Check if viewer can command (give orders to) target.
    Rules:
      - Higher level always commands lower level
      - Same level: depends on department/school scope
      - Cross-cutting roles command everyone
      - HOD commands lecturers and students in their department
      - Dean commands HODs, lecturers, students in their school
    """
    viewer_level = get_command_level(viewer)
    target_level = get_command_level(target)
    viewer_designation = (getattr(viewer, "designation", "") or "").lower()

    # Cross-cutting roles command everyone
    if viewer_designation in CROSS_CUTTING_DESIGNATIONS:
        return True

    # Higher level commands lower
    if viewer_level > target_level:
        # Dean must be in same school to command HOD/lecturer/student
        if viewer_level == CommandLevel.DEAN and target_level <= CommandLevel.HOD:
            return viewer.school and viewer.school == target.school
        # HOD must be in same department
        if viewer_level == CommandLevel.HOD and target_level <= CommandLevel.LECTURER:
            return viewer.department and viewer.department == target.department
        return True

    # Same level: cannot command
    return False


def get_scope_filter(user, model_name="notice"):
    """
    Return a Q filter for what content a user can see based on hierarchy.
    
    - VC/Registrar/Business/Security: see ALL
    - Dean: see their school + cross-school content
    - HOD: see their department + cross-department content
    - Lecturer: see their department + general
    - Student: see their school/department + general + followed departments
    """
    from django.db.models import Q

    designation = (getattr(user, "designation", "") or "").lower()

    # For Notice model, school is derived from creator profile.
    # For user-scoped models, school is a direct field.
    is_notice_model = (model_name or "").lower() == "notice"
    school_field = "created_by__school" if is_notice_model else "school"

    general_departments = (
        Q(department="")
        | Q(department__isnull=True)
        | Q(department__iexact="general")
        | Q(department__iexact="all")
        | Q(department__iexact="all_students_and_staff")
    )

    def department_match(value: str):
        if not value:
            return Q()
        return Q(department__iexact=value)

    # Cross-cutting: see everything
    if designation in CROSS_CUTTING_DESIGNATIONS:
        return Q()

    # Dean: see their school
    if designation == "dean":
        school_value = getattr(user, "school", "")
        if school_value:
            return Q(**{school_field: school_value}) | general_departments
        return general_departments

    # HOD: see their department
    if designation == "hod":
        return department_match(getattr(user, "department", "")) | general_departments

    # Lecturer: see their department
    if designation == "lecturer":
        return department_match(getattr(user, "department", "")) | general_departments

    # Student: see their school/department, followed departments, and general
    followed = getattr(user, "followed_departments", []) or []
    filters = general_departments
    for dept in followed:
        if dept:
            filters |= Q(department__iexact=dept)
    if getattr(user, "school", ""):
        filters |= Q(**{school_field: user.school})
    filters |= department_match(getattr(user, "department", ""))
    return filters


def get_subordinates(user):
    """Get all users that fall under this user's command."""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    designation = (getattr(user, "designation", "") or "").lower()
    level = get_command_level(user)

    # Cross-cutting: all non-cross-cutting users
    if designation in CROSS_CUTTING_DESIGNATIONS:
        return User.objects.exclude(
            designation__in=list(CROSS_CUTTING_DESIGNATIONS)
        ).exclude(is_superuser=True)

    # Dean: all in same school below dean level
    if designation == "dean":
        return User.objects.filter(
            school=user.school,
        ).exclude(
            designation__in=["dean", "vice_chancellor", "registrar", "business_office", "security"]
        )

    # HOD: all in same department below HOD level
    if designation == "hod":
        return User.objects.filter(
            department=user.department,
        ).exclude(
            designation__in=["hod", "dean", "vice_chancellor", "registrar", "business_office", "security"]
        )

    # Lecturer: students in same department
    if designation == "lecturer":
        return User.objects.filter(
            department=user.department,
            designation="student",
        )

    return User.objects.none()
