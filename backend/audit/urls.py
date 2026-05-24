from django.urls import path
from . import views

urlpatterns = [
    path("logs/", views.AuditLogListView.as_view(), name="audit-log-list"),
    path("data-export/", views.DataExportRequestView.as_view(), name="data-export"),
    path("data-delete/", views.DataDeletionRequestView.as_view(), name="data-delete"),
    path("data-delete/<uuid:deletion_id>/approve/", views.DataDeletionApproveView.as_view(), name="data-delete-approve"),
]
