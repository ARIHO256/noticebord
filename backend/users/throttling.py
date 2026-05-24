from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = "login"


class RegisterRateThrottle(AnonRateThrottle):
    scope = "register"


class FriendRequestRateThrottle(UserRateThrottle):
    scope = "friend_request"


class MessageRateThrottle(UserRateThrottle):
    scope = "message"


class CommentRateThrottle(UserRateThrottle):
    scope = "comment"


class ReportRateThrottle(UserRateThrottle):
    scope = "report"
