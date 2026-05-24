from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import DeviceToken, FriendRequest, Friendship, User, UserDesignation, get_friend_status


class MiniUserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "avatar_url"]

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if getattr(obj, "avatar", None):
            url = obj.avatar.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    avatar = serializers.ImageField(write_only=True, required=False, allow_null=True)
    friend_status = serializers.SerializerMethodField()
    friend_request_id = serializers.SerializerMethodField()
    mutual_friend_count = serializers.SerializerMethodField()
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "is_faculty",
            "is_active",
            "designation",
            "department",
            "school",
            "course",
            "academic_year",
            "phone",
            "avatar",
            "avatar_url",
            "friend_status",
            "friend_request_id",
            "mutual_friend_count",
        ]
        read_only_fields = ["id", "username", "email", "is_staff"]

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if getattr(obj, "avatar", None):
            url = obj.avatar.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None

    def get_friend_status(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return get_friend_status(user, obj)

    def get_friend_request_id(self, obj):
        request = self.context.get("request")
        viewer = getattr(request, "user", None)
        if not viewer or not getattr(viewer, "is_authenticated", False):
            return None
        status = get_friend_status(viewer, obj)
        if status == "outgoing":
            pending = FriendRequest.pending_between(viewer, obj)
            return pending.id if pending else None
        if status == "incoming":
            pending = FriendRequest.pending_between(obj, viewer)
            return pending.id if pending else None
        return None

    def get_mutual_friend_count(self, obj):
        request = self.context.get("request")
        viewer = getattr(request, "user", None)
        if not viewer or not getattr(viewer, "is_authenticated", False):
            return 0
        if viewer.id == obj.id:
            return 0
        return len(Friendship.mutual_friend_ids(viewer, obj))

    def update(self, instance, validated_data):
        """
        Override update to allow avatar upload without altering account status.
        """
        avatar_value = validated_data.pop("avatar", serializers.empty)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if avatar_value is not serializers.empty:
            instance.avatar = avatar_value

        instance.save()
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)
    school = serializers.CharField(required=True)
    department = serializers.CharField(required=True)
    course = serializers.CharField(required=True)
    academic_year = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "school",
            "department",
            "course",
            "academic_year",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.designation = UserDesignation.STUDENT
        user.set_password(password)
        user.save()
        return user


class StaffRegisterSerializer(serializers.ModelSerializer):
    """
    Serializer for registering staff accounts (VC, Registrar, Business Office, Security, Lecturer, Dean, HOD).
    """
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=True)
    last_name = serializers.CharField(required=True)
    designation = serializers.ChoiceField(choices=UserDesignation.choices, required=True)
    department = serializers.CharField(required=False, allow_blank=True)
    school = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "designation",
            "department",
            "school",
            "phone",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        designation = validated_data.get("designation", UserDesignation.OTHER)
        
        user = User(**validated_data)
        user.designation = designation
        
        # Set is_staff and is_faculty based on designation
        if designation in [
            UserDesignation.VICE_CHANCELLOR,
            UserDesignation.REGISTRAR,
            UserDesignation.BUSINESS_OFFICE,
            UserDesignation.SECURITY,
            UserDesignation.DEAN,
            UserDesignation.HOD,
        ]:
            user.is_staff = True

        if designation == UserDesignation.LECTURER:
            user.is_faculty = True
            user.is_staff = True
        
        user.set_password(password)
        user.save()
        return user


class DeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceToken
        fields = ["token"]


class FriendRequestSerializer(serializers.ModelSerializer):
    sender = MiniUserSerializer(read_only=True)
    receiver = MiniUserSerializer(read_only=True)
    receiver_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = FriendRequest
        fields = [
            "id",
            "sender",
            "receiver",
            "receiver_id",
            "status",
            "created_at",
            "responded_at",
        ]
        read_only_fields = ["id", "sender", "receiver", "status", "created_at", "responded_at"]

    def validate(self, attrs):
        request = self.context["request"]
        viewer = request.user
        receiver_id = self.initial_data.get("receiver_id")
        if not receiver_id:
            raise serializers.ValidationError({"receiver_id": "This field is required."})
        try:
            receiver = User.objects.get(pk=receiver_id)
        except ObjectDoesNotExist as exc:
            raise serializers.ValidationError({"receiver_id": "User not found."}) from exc
        if receiver == viewer:
            raise serializers.ValidationError("You cannot send a friend request to yourself.")
        if Friendship.are_friends(viewer, receiver):
            raise serializers.ValidationError("You are already friends.")
        if FriendRequest.pending_between(viewer, receiver):
            raise serializers.ValidationError("Friend request already sent.")
        if FriendRequest.pending_between(receiver, viewer):
            raise serializers.ValidationError("This user has already sent you a request.")
        attrs["sender"] = viewer
        attrs["receiver"] = receiver
        return attrs

    def create(self, validated_data):
        sender = validated_data["sender"]
        receiver = validated_data["receiver"]
        request_obj, created = FriendRequest.objects.get_or_create(
            sender=sender,
            receiver=receiver,
            defaults={"status": FriendRequest.STATUS_PENDING},
        )
        if not created:
            request_obj.status = FriendRequest.STATUS_PENDING
            request_obj.responded_at = None
            request_obj.save(update_fields=["status", "responded_at"])
        return request_obj


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Allow authentication using email by mapping the provided identifier to the user's username.
    Also allows suspended users to authenticate (they will be redirected to appeal screen).
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Allow clients to send only email (or username) without triggering "username required".
        if self.username_field in self.fields:
            self.fields[self.username_field].required = False
            self.fields[self.username_field].allow_blank = True
        # Accept an explicit email field as an alternative identifier.
        self.fields["email"] = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        username_or_email = attrs.get(self.username_field) or attrs.get("username") or attrs.get("email")
        if username_or_email:
            UserModel = get_user_model()
            identifier = username_or_email
            # Try to resolve by email first (case-insensitive)
            email_matches = list(UserModel.objects.filter(**{f"{UserModel.EMAIL_FIELD}__iexact": identifier})[:2])
            user = None
            if len(email_matches) == 1:
                user = email_matches[0]
            elif len(email_matches) > 1:
                # If multiple share the same email, fall back to username match
                user = UserModel.objects.filter(username__iexact=identifier).first()
                if not user:
                    from rest_framework_simplejwt.exceptions import AuthenticationFailed
                    raise AuthenticationFailed(
                        "Multiple accounts use this email. Please log in with your username or contact support.",
                        code="multiple_accounts",
                    )
            else:
                # No email match; allow username lookup
                user = UserModel.objects.filter(username__iexact=identifier).first()

            if user:
                attrs["username"] = user.get_username()
            else:
                # Leave attrs untouched so default validation will raise invalid credentials
                attrs["username"] = identifier
        
        # Manually authenticate to allow suspended users
        from django.contrib.auth import authenticate
        UserModel = get_user_model()
        username = attrs.get("username")
        password = attrs.get("password")
        
        if username and password:
            # Try normal authentication first
            user = authenticate(request=self.context.get("request"), username=username, password=password)
            
            # If normal auth fails (likely because user is suspended), 
            # try to get user and check password manually
            # This allows suspended users to authenticate
            if user is None:
                try:
                    user = UserModel.objects.get(username=username)
                    if not user.check_password(password):
                        # Invalid password
                        from rest_framework_simplejwt.exceptions import AuthenticationFailed
                        raise AuthenticationFailed(
                            self.error_messages["no_active_account"],
                            "no_active_account",
                        )
                    # Password is correct, user exists (may be suspended)
                except UserModel.DoesNotExist:
                    from rest_framework_simplejwt.exceptions import AuthenticationFailed
                    raise AuthenticationFailed(
                        self.error_messages["no_active_account"],
                        "no_active_account",
                    )
            
            if not user:
                from rest_framework_simplejwt.exceptions import AuthenticationFailed
                raise AuthenticationFailed(
                    self.error_messages["no_active_account"],
                    "no_active_account",
                )
            
            # Generate tokens for the user (even if suspended)
            refresh = self.get_token(user)
            
            data = {}
            data["refresh"] = str(refresh)
            data["access"] = str(refresh.access_token)
            
            return data
        else:
            # Fall back to parent validation
            return super().validate(attrs)
