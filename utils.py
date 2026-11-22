import re
from functools import wraps
from flask import session, redirect, url_for, request, jsonify, g, current_app, flash
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from config import Config

def get_serializer():
    """Retrieve serializer using runtime app SECRET_KEY with fallback to Config."""
    secret = Config.SECRET_KEY
    if current_app:
        secret = current_app.config.get('SECRET_KEY', secret)
    return URLSafeTimedSerializer(secret)

DAILY_MOTIVATIONS = [
    {"quote": "You don't have to control your thoughts. You just have to stop letting them control you.", "author": "Dan Millman", "tag": "Calm"},
    {"quote": "Every small step forward is proof that you are trying, growing, and moving.", "author": "MoodMate", "tag": "Encouragement"},
    {"quote": "Feelings come and go like clouds in a windy sky. Conscious breathing is my anchor.", "author": "Thich Nhat Hanh", "tag": "Mindfulness"},
    {"quote": "Be gentle with yourself. You are doing the best you can with what you have.", "author": "Unknown", "tag": "Self-Compassion"},
    {"quote": "Almost everything will work again if you unplug it for a few minutes, including you.", "author": "Anne Lamott", "tag": "Rest"},
    {"quote": "You are allowed to be both a masterpiece and a work in progress simultaneously.", "author": "Sophia Bush", "tag": "Acceptance"},
    {"quote": "Healing is not linear. Celebrate every breath and tiny win today.", "author": "MoodMate", "tag": "Growth"},
    {"quote": "Within you, there is a stillness and a sanctuary to which you can retreat at any time.", "author": "Hermann Hesse", "tag": "Inner Peace"}
]

JOURNAL_PROMPTS = [
    "What is one gentle thing you can do for yourself today?",
    "Describe a moment in the past week when you felt truly at ease.",
    "What emotion is calling for your attention right now, and why?",
    "What is something you are proud of accomplishing, no matter how small?",
    "Write a short, forgiving letter to yourself about something you've been stressing over.",
    "What are three things in your environment right now that bring you comfort?",
    "If your heart could speak right now without any filter, what would it say?",
    "What is one expectation you can gently release today?"
]

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Strict validation: user must be verified and loaded into g.current_user
        if not getattr(g, 'current_user', None):
            # Clean up stale session, preserving only CSRF token for future requests
            csrf = session.get('csrf_token')
            session.clear()
            if csrf:
                session['csrf_token'] = csrf
            if request.is_json or request.path.startswith('/api/'):
                return jsonify({'error': 'Authentication required or session expired', 'login_required': True}), 401
            flash('Your session has expired or is invalid. Please sign in again.', 'warning')
            return redirect(url_for('login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

def validate_email(email):
    """Validate email pattern."""
    if not email:
        return False
    pattern = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    return bool(re.match(pattern, email.strip()))

def validate_password(password):
    """Ensure password meets reasonable minimum requirements."""
    if not password or len(password) < 6:
        return False, "Password must be at least 6 characters long."
    return True, ""

def generate_reset_token(email):
    """Generate a signed, timed password reset token valid for 1 hour."""
    return get_serializer().dumps(email, salt='password-reset-salt')

def verify_reset_token(token, max_age_seconds=3600):
    """Verify and decode reset token."""
    try:
        email = get_serializer().loads(token, salt='password-reset-salt', max_age=max_age_seconds)
        return email
    except (SignatureExpired, BadSignature):
        return None
