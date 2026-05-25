from django.db.models import Count, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Group, GroupMembership, GroupMessage, GroupMessageRead
from .serializers import (
    GroupListSerializer,
    GroupDetailSerializer,
    GroupMembershipSerializer,
    GroupMessageSerializer,
)


class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.filter(is_active=True)
    serializer_class = GroupListSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["group_type", "department", "school", "is_public"]
    search_fields = ["name", "description", "course"]
    ordering_fields = ["created_at", "name"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return GroupDetailSerializer
        return GroupListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.annotate(member_count=Count("memberships", filter=Q(memberships__is_active=True)))
        my_groups = self.request.query_params.get("my_groups")
        if my_groups == "1":
            qs = qs.filter(memberships__user=self.request.user, memberships__is_active=True)
        return qs

    def perform_create(self, serializer):
        group = serializer.save(created_by=self.request.user)
        GroupMembership.objects.create(
            group=group,
            user=self.request.user,
            role=GroupMembership.Role.ADMIN,
        )

    @action(detail=True, methods=["post"], url_path="join")
    def join(self, request, pk=None):
        group = self.get_object()
        membership, created = GroupMembership.objects.get_or_create(
            group=group,
            user=request.user,
            defaults={"role": GroupMembership.Role.MEMBER},
        )
        if not created:
            membership.is_active = True
            membership.save(update_fields=["is_active"])
        return Response(GroupMembershipSerializer(membership).data)

    @action(detail=True, methods=["post"], url_path="leave")
    def leave(self, request, pk=None):
        group = self.get_object()
        GroupMembership.objects.filter(group=group, user=request.user).update(is_active=False)
        return Response({"detail": "Left group."})

    @action(detail=True, methods=["post"], url_path="add-member")
    def add_member(self, request, pk=None):
        group = self.get_object()
        user_id = request.data.get("user_id")
        role = request.data.get("role", GroupMembership.Role.MEMBER)
        if not request.user.is_staff:
            membership = group.memberships.filter(user=request.user, is_active=True).first()
            if not membership or membership.role not in [GroupMembership.Role.ADMIN, GroupMembership.Role.MODERATOR]:
                return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        membership, created = GroupMembership.objects.get_or_create(
            group=group, user=user, defaults={"role": role, "is_active": True}
        )
        if not created:
            membership.role = role
            membership.is_active = True
            membership.save()
        return Response(GroupMembershipSerializer(membership).data)

    @action(detail=True, methods=["post"], url_path="remove-member")
    def remove_member(self, request, pk=None):
        group = self.get_object()
        user_id = request.data.get("user_id")
        if not request.user.is_staff:
            membership = group.memberships.filter(user=request.user, is_active=True).first()
            if not membership or membership.role != GroupMembership.Role.ADMIN:
                return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        GroupMembership.objects.filter(group=group, user_id=user_id).update(is_active=False)
        return Response({"detail": "Member removed."})

    @action(detail=True, methods=["get"], url_path="messages")
    def messages(self, request, pk=None):
        group = self.get_object()
        if not group.memberships.filter(user=request.user, is_active=True).exists():
            return Response({"detail": "You are not a member of this group."}, status=status.HTTP_403_FORBIDDEN)
        qs = GroupMessage.objects.filter(group=group)
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = GroupMessageSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)
        serializer = GroupMessageSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="send-message")
    def send_message(self, request, pk=None):
        group = self.get_object()
        membership = group.memberships.filter(user=request.user, is_active=True).first()
        if not membership:
            return Response({"detail": "You are not a member of this group."}, status=status.HTTP_403_FORBIDDEN)
        if group.only_admin_can_post and membership.role not in [GroupMembership.Role.ADMIN, GroupMembership.Role.MODERATOR]:
            return Response({"detail": "Only admins can post in this group."}, status=status.HTTP_403_FORBIDDEN)
        serializer = GroupMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        msg = serializer.save(group=group, sender=request.user)
        return Response(GroupMessageSerializer(msg, context={"request": request}).data, status=status.HTTP_201_CREATED)


class GroupMessageViewSet(viewsets.ModelViewSet):
    queryset = GroupMessage.objects.all()
    serializer_class = GroupMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return GroupMessage.objects.filter(group__memberships__user=self.request.user, group__memberships__is_active=True)

    def perform_update(self, serializer):
        instance = serializer.save()
        instance.mark_edited()

    @action(detail=True, methods=["post"], url_path="pin")
    def pin(self, request, pk=None):
        msg = self.get_object()
        group = msg.group
        membership = group.memberships.filter(user=request.user, is_active=True).first()
        if not membership or membership.role not in [GroupMembership.Role.ADMIN, GroupMembership.Role.MODERATOR]:
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
        GroupMessage.objects.filter(group=group).update(is_pinned=False)
        msg.is_pinned = True
        msg.save(update_fields=["is_pinned"])
        return Response(GroupMessageSerializer(msg, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request, pk=None):
        msg = self.get_object()
        GroupMessageRead.objects.get_or_create(message=msg, user=request.user)
        return Response({"detail": "Marked as read."})
