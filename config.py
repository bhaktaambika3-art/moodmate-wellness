import os
from datetime import timedelta
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'moodmate-secret-dev-key-change-in-production-2026')
    
    # Database URL handling (converts Render's postgres:// to postgresql:// for SQLAlchemy 2)
    database_url = os.environ.get('DATABASE_URL')
    if database_url and database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql://', 1)
        
    SQLALCHEMY_DATABASE_URI = database_url or f"sqlite:///{os.path.join(os.path.abspath(os.path.dirname(__file__)), 'moodmate.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Session lifetime
    PERMANENT_SESSION_LIFETIME = timedelta(days=14)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
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
