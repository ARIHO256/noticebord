from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from users.models import User, UserBlock
from notifications.models import Notification


class SocialControlsTests(APITestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            username="alpha",
            email="alpha@bugema.ac.ug",
            password="pass123",
            designation="student",
        )
        self.user_b = User.objects.create_user(
            username="beta",
            email="beta@bugema.ac.ug",
            password="pass123",
            designation="student",
        )

    def test_user_can_block_another_user(self):
        client = APIClient()
        client.force_authenticate(user=self.user_a)

        block_resp = client.post(f"/api/v1/users/profiles/{self.user_b.id}/block/")
        self.assertIn(block_resp.status_code, (status.HTTP_200_OK, status.HTTP_201_CREATED))
        self.assertTrue(UserBlock.objects.filter(blocker=self.user_a, blocked=self.user_b).exists())

        list_resp = client.get("/api/v1/users/profiles/blocked/")
        self.assertEqual(list_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(any(row.get("blocked") == self.user_b.id for row in list_resp.data))

    def test_blocked_users_cannot_send_friend_request(self):
        blocker = APIClient()
        blocker.force_authenticate(user=self.user_a)
        blocker.post(f"/api/v1/users/profiles/{self.user_b.id}/block/")

        blocked = APIClient()
        blocked.force_authenticate(user=self.user_b)
        response = blocked.post("/api/v1/users/friend-requests/", {"receiver_id": self.user_a.id}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_faculty_list_hides_blocked_users_and_uses_public_serializer(self):
        faculty_visible = User.objects.create_user(
            username="faculty_visible",
            email="fvisible@bugema.ac.ug",
            password="pass123",
            designation="lecturer",
            is_faculty=True,
            is_staff=True,
        )
        faculty_blocked = User.objects.create_user(
            username="faculty_blocked",
            email="fblocked@bugema.ac.ug",
            password="pass123",
            designation="lecturer",
            is_faculty=True,
            is_staff=True,
        )

        UserBlock.objects.create(blocker=self.user_a, blocked=faculty_blocked)

        client = APIClient()
        client.force_authenticate(user=self.user_a)
        response = client.get("/api/v1/users/profiles/faculty/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        usernames = [row.get("username") for row in response.data]
        self.assertIn(faculty_visible.username, usernames)
        self.assertNotIn(faculty_blocked.username, usernames)
        self.assertTrue(response.data)
        self.assertNotIn("email", response.data[0])

    def test_friend_request_flow_creates_notifications(self):
        sender = APIClient()
        sender.force_authenticate(user=self.user_a)

        create_resp = sender.post(
            "/api/v1/users/friend-requests/",
            {"receiver_id": self.user_b.id},
            format="json",
        )
        self.assertEqual(create_resp.status_code, status.HTTP_201_CREATED)

        request_id = create_resp.data["id"]
        self.assertTrue(
            Notification.objects.filter(
                user=self.user_b,
                notification_type="friend_request",
                sender=self.user_a,
            ).exists()
        )

        receiver = APIClient()
        receiver.force_authenticate(user=self.user_b)
        accept_resp = receiver.post(f"/api/v1/users/friend-requests/{request_id}/accept/")
        self.assertEqual(accept_resp.status_code, status.HTTP_200_OK)

        self.assertTrue(
            Notification.objects.filter(
                user=self.user_a,
                notification_type="friend_accepted",
                sender=self.user_b,
            ).exists()
        )
