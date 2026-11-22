import secrets
from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    # Unique session token ensures complete session-user binding and protects against reused integer IDs
    session_token = db.Column(db.String(64), nullable=False, default=lambda: secrets.token_hex(32), index=True)
    avatar = db.Column(db.String(50), default='🌸')
    theme_preference = db.Column(db.String(20), default='system')  # 'system', 'light', 'dark'
    voice_preference = db.Column(db.String(100), default='warm')  # 'warm', 'calm', 'cheerful', 'gentle'
    voice_speed = db.Column(db.Float, default=1.0)
    auto_speak = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    mood_entries = db.relationship('MoodEntry', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    journal_entries = db.relationship('JournalEntry', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    tiny_wins = db.relationship('TinyWin', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    conversations = db.relationship('Conversation', backref='user', lazy='dynamic', cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def refresh_session_token(self):
        """Generates a new session token, revoking all other active browser sessions."""
        self.session_token = secrets.token_hex(32)
        return self.session_token

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'avatar': self.avatar,
            'theme_preference': self.theme_preference,
            'voice_preference': self.voice_preference,
            'voice_speed': self.voice_speed,
            'auto_speak': self.auto_speak,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class MoodEntry(db.Model):
    __tablename__ = 'mood_entries'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    mood_type = db.Column(db.String(50), nullable=False)  # happy, okay, sad, anxious, angry, exhausted, lonely, confused, calm
    intensity = db.Column(db.Integer, nullable=False)      # 1 to 10
    note = db.Column(db.Text, nullable=True)
    tags = db.Column(db.String(255), nullable=True)        # comma-separated tags
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'mood_type': self.mood_type,
            'intensity': self.intensity,
            'note': self.note or '',
            'tags': [t.strip() for t in self.tags.split(',')] if self.tags else [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'formatted_date': self.created_at.strftime('%b %d, %Y - %I:%M %p') if self.created_at else ''
        }


class JournalEntry(db.Model):
    __tablename__ = 'journal_entries'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    mood_tag = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'content': self.content,
            'mood_tag': self.mood_tag or '',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'formatted_date': self.created_at.strftime('%b %d, %Y - %I:%M %p') if self.created_at else ''
        }


class TinyWin(db.Model):
    __tablename__ = 'tiny_wins'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(50), default='general')  # health, productivity, mindfulness, self-care, social, creative, other
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'category': self.category,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'formatted_date': self.created_at.strftime('%b %d, %Y') if self.created_at else ''
        }


class Conversation(db.Model):
    __tablename__ = 'conversations'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    title = db.Column(db.String(150), default='New Conversation')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    messages = db.relationship('ChatMessage', backref='conversation', lazy='dynamic', cascade='all, delete-orphan', order_by='ChatMessage.created_at')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'formatted_date': self.updated_at.strftime('%b %d, %I:%M %p') if self.updated_at else ''
        }


class ChatMessage(db.Model):
    __tablename__ = 'chat_messages'

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id', ondelete='CASCADE'), nullable=False, index=True)
    sender = db.Column(db.String(20), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'sender': self.sender,
            'content': self.content,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'formatted_time': self.created_at.strftime('%I:%M %p') if self.created_at else ''
        }


def ensure_schema_compatibility(app):
    """
    Safely checks the database schema and ensures all required columns exist
    without deleting, resetting, or losing any existing user records.
    """
    with app.app_context():
        db.create_all()
        try:
            from sqlalchemy import inspect, text
            inspector = inspect(db.engine)
            if 'users' in inspector.get_table_names():
                columns = [col['name'] for col in inspector.get_columns('users')]
                if 'session_token' not in columns:
                    with db.engine.connect() as conn:
                        conn.execute(text("ALTER TABLE users ADD COLUMN session_token VARCHAR(64)"))
                        conn.commit()
                    # Backfill unique session tokens for any existing rows
                    users = User.query.filter((User.session_token == None) | (User.session_token == '')).all()
                    for u in users:
                        u.session_token = secrets.token_hex(32)
                    db.session.commit()
        except Exception as e:
            print(f"[Schema Check] Notice: {e}")
