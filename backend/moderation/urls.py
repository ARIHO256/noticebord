from django.urls import path
from . import views

app_name = 'moderation'

urlpatterns = [
    path('check-text/', views.check_text, name='check-text'),
    path('check-image/', views.check_image, name='check-image'),
    path('check-video/', views.check_video, name='check-video'),
    path('violations/', views.list_violations, name='list-violations'),
    path('suspended-users/', views.list_suspended_users, name='list-suspended-users'),
    path('violations/<int:violation_id>/resolve/', views.resolve_violation, name='resolve-violation'),
]

