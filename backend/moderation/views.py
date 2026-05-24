import io
import random
import re
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.files.base import ContentFile
from PIL import Image
from django.db import models
from .models import ContentViolation

# Profanity and inappropriate words list - ONLY truly immoral/explicit words
# Focus on words that are clearly inappropriate in ALL contexts (like TikTok bans)
PROFANITY_WORDS = [
    # Most explicit profanity only
    'fuck', 'fucking', 'fucked', 'fucker', 'fucks',
    'shit', 'shitting', 'shitted', 'shits',
    'bitch', 'bitches',
    'asshole', 'assholes',
    # Explicit sexual content (only when clearly inappropriate)
    'porn', 'pornography',
]

# Threatening phrases and sentences - focus on clear, direct threats
# Only phrases that are clearly threatening in most contexts
THREATENING_PHRASES = [
    # Self-harm threats
    'kill yourself',
    'kys',
    'go kill yourself',
    # Direct threats to others
    'i will kill you',
    'i\'ll kill you',
    'i will hurt you',
    'i\'ll hurt you',
    'i will harm you',
    'i\'ll harm you',
    'i will beat you',
    'i\'ll beat you',
    'i will attack you',
    'i\'ll attack you',
    # Death threats (more specific)
    'you should die',
    'i hope you die',
    'i wish you were dead',
    'go die',
    # Violence threats
    'i will stab you',
    'i\'ll stab you',
    'i will shoot you',
    'i\'ll shoot you',
    'i will punch you',
    'i\'ll punch you',
]

# Sexual harassment phrases - unwanted sexual advances and comments
# Focus on clear harassment patterns, not general compliments
SEXUAL_HARASSMENT_PHRASES = [
    # Explicit requests for sexual content
    'send me nudes',
    'send nudes',
    'show me your body',
    'show me your boobs',
    'show me your tits',
    'show me your ass',
    'show me your pussy',
    'show me your dick',
    'let me see your body',
    'let me see your boobs',
    'let me see your tits',
    'let me see your ass',
    'i want to see your body',
    'i want to see your boobs',
    'i want to see your tits',
    'i want to see your ass',
    # Explicit requests to undress
    'take off your clothes',
    'take your clothes off',
    'get naked',
    'strip for me',
    # Sexual propositions
    'be my sugar daddy',
    'be my sugar mommy',
    'sugar daddy',
    'sugar mommy',
    'want to hook up',
    'let\'s hook up',
    'come to my place',
    'come over to my place',
    'sleep with me',
    'have sex with me',
    'want to have sex',
    'let\'s have sex',
    'i want to have sex',
    'i want you sexually',
    'i need you sexually',
    # Explicit sexual comments (more specific)
    'nice ass',
    'nice tits',
    'nice boobs',
    'nice pussy',
    'nice dick',
]

# Hate speech and racism - slurs and derogatory terms
# Common racial slurs and hate speech terms
HATE_SPEECH_WORDS = [
    # Racial slurs (common ones - be careful with false positives)
    'nigger', 'nigga', 'nigg',
    'chink',
    'spic',
    'kike',
    'gook',
    'towelhead',
    'sand nigger',
    'taco',
    'wetback',
    # Other derogatory terms
    'retard', 'retarded',
    'faggot', 'fag',
    'tranny',
    'dyke',
]

# Hate speech phrases - racist and discriminatory statements
# Focus on clearly discriminatory phrases
HATE_SPEECH_PHRASES = [
    # Racist phrases
    'all [group] are',
    'you people are',
    'your kind',
    'go back to your country',
    'go back to where you came from',
    'you don\'t belong here',
    'you\'re not welcome here',
    'we don\'t want you here',
    'you\'re inferior',
    'you\'re subhuman',
    'you\'re less than human',
    'white power',
    'black power',
    'kill all [group]',
    'exterminate [group]',
    'ethnic cleansing',
    'racial purity',
    'you\'re a dirty [group]',
    'you\'re a stupid [group]',
    'you\'re an inferior [group]',
    'all [group] should die',
    'all [group] are criminals',
    'all [group] are terrorists',
]


def check_text_content(text: str) -> dict:
    """Check text for inappropriate content - TikTok-style moderation"""
    if not text or not text.strip():
        return {'is_safe': True, 'confidence': 1.0}

    text_lower = text.lower().strip()
    
    # Check for profanity - use word boundaries to avoid false positives
    found_profanity = []
    for word in PROFANITY_WORDS:
        # Use word boundaries to match whole words only
        # This prevents matching "class" when looking for "ass"
        pattern = r'\b' + re.escape(word.lower()) + r'\b'
        if re.search(pattern, text_lower):
            found_profanity.append(word)
    
    # Check for threatening phrases (exact phrase matching)
    found_threats = []
    for phrase in THREATENING_PHRASES:
        phrase_lower = phrase.lower()
        # Check if phrase exists as a substring (for multi-word phrases)
        if phrase_lower in text_lower:
            found_threats.append(phrase)
    
    # Check for sexual harassment phrases
    found_harassment = []
    for phrase in SEXUAL_HARASSMENT_PHRASES:
        phrase_lower = phrase.lower()
        if phrase_lower in text_lower:
            found_harassment.append(phrase)
    
    # Check for hate speech words (use word boundaries)
    found_hate_words = []
    for word in HATE_SPEECH_WORDS:
        pattern = r'\b' + re.escape(word.lower()) + r'\b'
        if re.search(pattern, text_lower):
            found_hate_words.append(word)
    
    # Check for hate speech phrases
    found_hate_phrases = []
    for phrase in HATE_SPEECH_PHRASES:
        phrase_lower = phrase.lower()
        # For phrases with placeholders like [group], check if pattern matches
        if '[' in phrase and ']' in phrase:
            # Replace [group] with a word pattern to match any word
            pattern = phrase_lower.replace('[group]', r'\w+')
            if re.search(pattern, text_lower):
                found_hate_phrases.append(phrase)
        else:
            # Regular phrase matching
            if phrase_lower in text_lower:
                found_hate_phrases.append(phrase)
    
    # Check for excessive caps (spam) - more lenient threshold
    caps_ratio = len(re.findall(r'[A-Z]', text)) / len(text) if text else 0
    is_spam = caps_ratio > 0.8 and len(text) > 30  # Increased threshold
    
    # Check for repeated characters (spam) - more lenient
    has_repeated = bool(re.search(r'(.)\1{6,}', text))  # Require 6+ repeated chars instead of 4+
    
    # Only flag if we find actual violations
    # Be very conservative - only flag if we're absolutely certain
    has_violation = (
        len(found_profanity) > 0 or 
        len(found_threats) > 0 or 
        len(found_harassment) > 0 or 
        len(found_hate_words) > 0 or 
        len(found_hate_phrases) > 0
    )
    
    # Safety check: Only mark as unsafe if we found explicit profanity or clear threats
    # Everything else is safe
    is_safe = not has_violation
    
    categories = []
    if found_profanity:
        categories.append('profanity')
    if found_threats:
        categories.append('threatening')
    if found_harassment:
        categories.append('sexual_harassment')
    if found_hate_words or found_hate_phrases:
        categories.append('hate_speech')
    if is_spam or has_repeated:
        categories.append('spam')
    
    # Higher confidence for actual violations, lower for spam
    confidence = 0.95 if has_violation else 0.5 if (is_spam or has_repeated) else 1.0
    
    reason = None
    if not is_safe:
        reasons = []
        if found_profanity:
            reasons.append(f"Contains inappropriate language")
        if found_threats:
            reasons.append(f"Contains threatening content")
        if found_harassment:
            reasons.append(f"Contains sexual harassment")
        if found_hate_words or found_hate_phrases:
            reasons.append(f"Contains hate speech or racism")
        reason = '; '.join(reasons) or 'Content violates community guidelines'
    
    return {
        'is_safe': is_safe,
        'confidence': confidence,
        'categories': categories,
        'reason': reason,
    }


def check_image_content(image_data: bytes) -> dict:
    """Check image for inappropriate content using basic heuristics"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Try to open and analyze image
        image = Image.open(io.BytesIO(image_data))
        
        # Focus checks only on strong pornographic signals (high skin exposure).
        width, height = image.size
        # Check for skin tone detection (basic heuristic)
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Sample more pixels for better detection (increased from 1000)
        pixels = list(image.getdata())
        total_pixels = len(pixels)
        sample_size = min(5000, total_pixels)  # Increased sample size
        
        # Use random sampling for better coverage, or sample from different regions
        if total_pixels > sample_size:
            sample_pixels = random.sample(pixels, sample_size)
        else:
            sample_pixels = pixels
        
        skin_pixel_count = 0
        flesh_tone_count = 0
        
        for r, g, b in sample_pixels:
            # Basic skin tone detection (RGB ranges for human skin)
            # More comprehensive skin tone ranges
            is_skin = (
                r > 95 and g > 40 and b > 20 and
                max(r, g, b) - min(r, g, b) > 15 and
                abs(r - g) > 15 and r > g and r > b
            )
            
            # Additional flesh tone detection (broader range)
            is_flesh = (
                (r > 80 and g > 50 and b > 30) and
                (r < 250 and g < 220 and b < 200) and
                abs(r - g) > 10
            )
            
            if is_skin:
                skin_pixel_count += 1
            if is_flesh:
                flesh_tone_count += 1
        
        skin_ratio = skin_pixel_count / sample_size if sample_size > 0 else 0
        flesh_ratio = flesh_tone_count / sample_size if sample_size > 0 else 0
        
        # Only flag when we have strong pornographic signals: very high skin/flesh ratios.
        is_portrait = height > width
        strong_skin_signal = skin_ratio > 0.6 or (is_portrait and skin_ratio > 0.55 and flesh_ratio > 0.55)
        strong_flesh_signal = flesh_ratio > 0.65

        if strong_skin_signal or strong_flesh_signal:
            logger.warning(f"Image flagged for potential explicit content: skin_ratio={skin_ratio:.2f}, flesh_ratio={flesh_ratio:.2f}, portrait={is_portrait}")
            return {
                'is_safe': False,
                'confidence': 0.8,
                'categories': ['potential_nudity'],
                'reason': 'Image likely contains explicit content',
            }
        
        logger.info(f"Image passed moderation (only porn/violence signals checked): skin_ratio={skin_ratio:.2f}, flesh_ratio={flesh_ratio:.2f}")
        
        # For production, you would integrate with:
        # - Google Cloud Vision API (SafeSearch)
        # - AWS Rekognition (Content Moderation)
        # - Azure Content Moderator
        # - Sightengine API
        
        return {
            'is_safe': True,
            'confidence': 0.8,
        }
        
    except Exception as e:
        # If we can't analyze, fail closed for safety
        logger.error(f"Error analyzing image: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            'is_safe': False,
            'confidence': 0.5,
            'categories': ['analysis_error'],
            'reason': f'Unable to analyze image: {str(e)}',
        }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_text(request):
    """Check text content for inappropriate material"""
    text = request.data.get('text', '')
    
    if not text:
        return Response(
            {'is_safe': True, 'confidence': 1.0},
            status=status.HTTP_200_OK
        )
    
    result = check_text_content(text)
    
    # Track violations for admin review
    # Automatic suspension has been disabled - manual admin review is required
    if not result['is_safe']:
        user = request.user
        # Create violation record for admin review
        ContentViolation.objects.create(
            user=user,
            violation_type='text',
            category=result.get('categories', ['unknown'])[0] if result.get('categories') else 'unknown',
            content_preview=text[:200],  # Store preview (first 200 chars)
        )
        
    return Response(result, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_image(request):
    """Image moderation disabled; always allow. Staff can handle issues manually."""
    return Response(
        {
            'is_safe': True,
            'confidence': 1.0,
            'categories': [],
            'reason': 'Image moderation disabled',
        },
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_video(request):
    """Check video content for inappropriate material"""
    # For videos, we would need to extract frames and analyze them
    # This is a placeholder - in production, use video analysis APIs
    
    video_uri = request.data.get('video_uri', '')
    
    if not video_uri:
        return Response(
            {'error': 'No video provided'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # For now, return a basic check
    # In production, you would:
    # 1. Extract key frames from video
    # 2. Analyze each frame using image analysis
    # 3. Check audio for inappropriate content
    
    return Response(
        {
            'is_safe': True,  # Placeholder - should be analyzed
            'confidence': 0.5,
            'reason': 'Video analysis not fully implemented. Please ensure content is appropriate.',
        },
        status=status.HTTP_200_OK
    )


def can_view_violations(user):
    """Check if user has permission to view violations"""
    if user.is_superuser or user.is_staff:
        return True
    
    # Check for specific roles
    designation = getattr(user, 'designation', '').lower()
    allowed_designations = ['dean', 'hod', 'head of department', 'vice_chancellor', 'vc']
    
    return designation in allowed_designations


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_violations(request):
    """List all content violations (admin only)"""
    user = request.user
    
    if not can_view_violations(user):
        return Response(
            {'detail': 'You do not have permission to view violations.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    from .models import ContentViolation
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    # Get query parameters
    user_id = request.query_params.get('user_id')
    violation_type = request.query_params.get('type')
    category = request.query_params.get('category')
    is_resolved = request.query_params.get('is_resolved')
    suspended_only = request.query_params.get('suspended_only', 'false').lower() == 'true'
    
    # Build queryset
    violations = ContentViolation.objects.select_related('user').all()
    
    if user_id:
        violations = violations.filter(user_id=user_id)
    if violation_type:
        violations = violations.filter(violation_type=violation_type)
    if category:
        violations = violations.filter(category=category)
    if is_resolved is not None:
        violations = violations.filter(is_resolved=is_resolved.lower() == 'true')
    
    # If suspended_only, filter to users who are currently suspended
    if suspended_only:
        suspended_user_ids = User.objects.filter(is_active=False).values_list('id', flat=True)
        violations = violations.filter(user_id__in=suspended_user_ids)
    
    violations = violations.order_by('-created_at')[:100]  # Limit to 100 most recent
    
    # Serialize violations
    results = []
    for violation in violations:
        # Skip if user is None (shouldn't happen, but safety check)
        if not violation.user:
            continue
            
        user_violations_count = ContentViolation.objects.filter(
            user=violation.user,
            is_resolved=False
        ).count()
        
        results.append({
            'id': violation.id,
            'user': {
                'id': violation.user.id,
                'username': violation.user.username or '',
                'email': violation.user.email or '',
                'first_name': violation.user.first_name or '',
                'last_name': violation.user.last_name or '',
                'is_active': violation.user.is_active,
            },
            'violation_type': violation.violation_type or '',
            'category': violation.category or '',
            'content_preview': violation.content_preview or '',
            'created_at': violation.created_at.isoformat() if violation.created_at else None,
            'is_resolved': violation.is_resolved,
            'user_violations_count': user_violations_count,
        })
    
    return Response({'results': results}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_suspended_users(request):
    """List all suspended users (admin only)"""
    user = request.user
    
    if not can_view_violations(user):
        return Response(
            {'detail': 'You do not have permission to view suspended users.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    from django.contrib.auth import get_user_model
    from .models import ContentViolation
    from django.db.models import Count
    from datetime import timedelta
    from django.utils import timezone
    
    User = get_user_model()
    
    # Get suspended users
    suspended_users = User.objects.filter(is_active=False).annotate(
        violation_count=Count('violations', filter=models.Q(violations__is_resolved=False))
    )
    
    # Get recent violations for each user
    thirty_days_ago = timezone.now() - timedelta(days=30)
    
    results = []
    for user_obj in suspended_users:
        try:
            recent_violations = ContentViolation.objects.filter(
                user=user_obj,
                created_at__gte=thirty_days_ago,
                is_resolved=False,
            ).count()
            
            total_violations = ContentViolation.objects.filter(
                user=user_obj,
                is_resolved=False,
            ).count()
            
            last_violation = ContentViolation.objects.filter(
                user=user_obj
            ).order_by('-created_at').first()
            
            results.append({
                'id': user_obj.id,
                'username': user_obj.username or '',
                'email': user_obj.email or '',
                'first_name': user_obj.first_name or '',
                'last_name': user_obj.last_name or '',
                'designation': getattr(user_obj, 'designation', '') or '',
                'department': getattr(user_obj, 'department', '') or '',
                'recent_violations': recent_violations,
                'total_violations': total_violations,
                'last_violation_at': last_violation.created_at.isoformat() if last_violation and last_violation.created_at else None,
                'last_violation_type': last_violation.violation_type if last_violation else None,
                'last_violation_category': last_violation.category if last_violation else None,
            })
        except Exception as e:
            # Log error but continue processing other users
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error processing suspended user {user_obj.id}: {str(e)}")
            continue
    
    return Response({'results': results}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resolve_violation(request, violation_id):
    """Mark a violation as resolved (admin only)"""
    user = request.user
    
    if not can_view_violations(user):
        return Response(
            {'detail': 'You do not have permission to resolve violations.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    from .models import ContentViolation
    
    try:
        violation = ContentViolation.objects.get(id=violation_id)
        violation.is_resolved = True
        violation.save(update_fields=['is_resolved'])
        
        return Response({'status': 'resolved'}, status=status.HTTP_200_OK)
    except ContentViolation.DoesNotExist:
        return Response(
            {'detail': 'Violation not found.'},
            status=status.HTTP_404_NOT_FOUND
        )
