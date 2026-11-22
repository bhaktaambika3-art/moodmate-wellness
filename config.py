import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    # Secret key for signing sessions and tokens
    SECRET_KEY = os.environ.get('SECRET_KEY', 'moodmate-secret-dev-key-change-in-production-2026')
    
    # Database URL handling (converts Render's postgres:// to postgresql:// for SQLAlchemy 2)
    database_url = os.environ.get('DATABASE_URL', '').strip()
    if database_url:
        if database_url.startswith('postgres://'):
            database_url = database_url.replace('postgres://', 'postgresql://', 1)
        # Ensure Neon / cloud PostgreSQL connections enforce SSL
        if database_url.startswith('postgresql://') and 'sslmode=' not in database_url:
            separator = '&' if '?' in database_url else '?'
            database_url = f"{database_url}{separator}sslmode=require"
            
    SQLALCHEMY_DATABASE_URI = database_url or f"sqlite:///{os.path.join(os.path.abspath(os.path.dirname(__file__)), 'moodmate.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Cloud PostgreSQL / Neon connection pool resilience (pre-ping detects closed serverless connections)
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    
    # Session cookie hardening
    SESSION_COOKIE_NAME = 'moodmate_session'
    PERMANENT_SESSION_LIFETIME = timedelta(days=14)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    # Automatically enforce HTTPS-only cookies in production or on Render
    SESSION_COOKIE_SECURE = (
        os.environ.get('RENDER') is not None or 
        os.environ.get('FLASK_ENV') == 'production' or 
        os.environ.get('SESSION_COOKIE_SECURE', 'false').lower() == 'true'
    )
    
    # Groq API configuration
    GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')
    # Preferred model as requested: openai/gpt-oss-120b, with graceful fallbacks
    GROQ_MODEL = os.environ.get('GROQ_MODEL', 'openai/gpt-oss-120b')
    GROQ_FALLBACK_MODELS = [
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
        'llama3-70b-8192',
        'mixtral-8x7b-32768',
        'gemma2-9b-it'
    ]
