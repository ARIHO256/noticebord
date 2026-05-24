from django.urls import path
from . import views

urlpatterns = [
    path("", views.NotificationListView.as_view(), name="notification-list"),
    path("mark-read/", views.NotificationMarkReadView.as_view(), name="notification-mark-read"),
    path("delete/", views.NotificationDeleteView.as_view(), name="notification-delete"),
    path("unread-count/", views.UnreadCountView.as_view(), name="notification-unread-count"),
    path("preferences/", views.NotificationPreferenceView.as_view(), name="notification-preferences"),
]
