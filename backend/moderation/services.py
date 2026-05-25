"""
Content moderation services.
"""

# Simple profanity/threat word lists for demo purposes
# In production, integrate with AI-based moderation APIs

PROFANITY_WORDS = [
    "badword1", "badword2", "badword3",  # Placeholder
]

THREAT_WORDS = [
    "kill", "attack", "bomb", "threat",
]

HARASSMENT_WORDS = [
    "stupid", "idiot", "loser",
]


def moderate_text(text):
    """
    Check text for content violations.
    Returns dict with violation info.
    """
    if not text:
        return {"violation": False, "reason": ""}

    text_lower = text.lower()

    for word in PROFANITY_WORDS:
        if word in text_lower:
            return {"violation": True, "reason": f"Profanity detected: {word}"}

    for word in THREAT_WORDS:
        if word in text_lower:
            return {"violation": True, "reason": f"Threat detected: {word}"}

    for word in HARASSMENT_WORDS:
        if word in text_lower:
            return {"violation": True, "reason": f"Harassment detected: {word}"}

    return {"violation": False, "reason": ""}


def moderate_image(image):
    """Placeholder for image moderation."""
    return {"violation": False, "reason": ""}


def moderate_video(video):
    """Placeholder for video moderation."""
    return {"violation": False, "reason": ""}
