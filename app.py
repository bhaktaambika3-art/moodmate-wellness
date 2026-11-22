import os
import random
import secrets
from datetime import datetime, timezone, timedelta
from flask import (
    Flask, render_template, request, redirect, url_for,
    session, flash, jsonify, make_response, g
)
from werkzeug.middleware.proxy_fix import ProxyFix
from sqlalchemy import func, desc

from config import Config
from models import db, User, MoodEntry, JournalEntry, TinyWin, Conversation, ChatMessage, ensure_schema_compatibility
from groq_service import generate_chat_response
from tts_service import get_voice_profiles
from utils import (
    login_required, validate_email, validate_password,
    generate_reset_token, verify_reset_token,
    DAILY_MOTIVATIONS, JOURNAL_PROMPTS
)

app = Flask(__name__)
app.config.from_object(Config)

# Proper proxy headers handling for Render and HTTPS reverse proxies
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# Initialize database
db.init_app(app)

# Ensure tables and compatible schema exist without overwriting or deleting any existing records
ensure_schema_compatibility(app)

# ==========================================
# SECURITY & SESSION HOOKS
# ==========================================

@app.before_request
def before_request_security_and_auth():
    # 1. Ensure CSRF token is present in session
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)

    # 2. Strict User & Session Validation
    # Guarantees that users cannot accidentally or maliciously access another user's account,
    # even across SQLite database wipes, reused numeric IDs, or stale session cookies.
    g.current_user = None
    user_id = session.get('user_id')
    if user_id is not None:
        user = db.session.get(User, user_id)
        session_token = session.get('session_token')
        session_email = session.get('user_email')

        # Require that:
        # - User exists in database
        # - User has a valid session token that matches the session cookie exactly
        # - User email matches the session cookie
        if (not user or 
            not user.session_token or 
            user.session_token != session_token or 
            user.email != session_email):
            # Invalid, stale, wiped, or hijacked session detected.
            # Clear invalid session immediately and keep only a fresh CSRF token.
            csrf = session.get('csrf_token')
            session.clear()
            if csrf:
                session['csrf_token'] = csrf
            g.current_user = None
        else:
            g.current_user = user

    # 3. CSRF Validation on State-Changing HTTP Methods
    if request.method in ('POST', 'PUT', 'DELETE', 'PATCH'):
        # Allow automated test suites to bypass unless explicitly enforcing CSRF
        if not app.config.get('TESTING') or app.config.get('TEST_CSRF_ENFORCED'):
            client_token = (
                request.headers.get('X-CSRFToken') or 
                request.headers.get('X-CSRF-Token') or 
                request.form.get('csrf_token')
            )
            if not client_token and request.is_json:
                try:
                    client_token = (request.get_json(silent=True) or {}).get('csrf_token')
                except Exception:
                    pass

            expected_token = session.get('csrf_token')
            if not expected_token or not client_token or not secrets.compare_digest(str(expected_token), str(client_token)):
                if request.is_json or request.path.startswith('/api/'):
                    return jsonify({'error': 'CSRF validation failed or token missing.'}), 400
                flash('Security token invalid or expired. Please submit the form again.', 'error')
                return redirect(request.referrer or url_for('login'))


@app.after_request
def add_security_headers(response):
    # 1. Prevent browser and proxy caching of sensitive user pages and all API routes
    if getattr(g, 'current_user', None) or 'user_id' in session or request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'

    # 2. Defensive HTTP headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response


# Context processor for templates
@app.context_processor
def inject_globals():
    # Pick daily motivation based on day of year
    day_index = datetime.now().timetuple().tm_yday % len(DAILY_MOTIVATIONS)
    daily_quote = DAILY_MOTIVATIONS[day_index]
    
    return {
        'current_user': getattr(g, 'current_user', None),
        'csrf_token': session.get('csrf_token', ''),
        'daily_quote': daily_quote,
        'current_year': datetime.now().year,
        'today_formatted': datetime.now().strftime('%A, %B %d, %Y')
    }

# ==========================================
# PUBLIC / AUTHENTICATION ROUTES
# ==========================================

@app.route('/')
def index():
    if getattr(g, 'current_user', None):
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if getattr(g, 'current_user', None):
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        remember = bool(request.form.get('remember'))

        if not email or not password:
            flash('Please enter both email and password.', 'error')
            return render_template('auth/login.html', email=email)

        user = User.query.filter_by(email=email).first()
        if not user or not user.check_password(password):
            flash('Invalid email or password. Please try again.', 'error')
            return render_template('auth/login.html', email=email)

        # Ensure user has a session_token (backfill if needed)
        if not user.session_token:
            user.refresh_session_token()
            db.session.commit()

        # Regenerate session to prevent session fixation and clear any prior state
        session.clear()
        session.permanent = remember
        session['user_id'] = user.id
        session['session_token'] = user.session_token
        session['user_email'] = user.email
        session['user_name'] = user.name
        session['theme'] = user.theme_preference
        session['csrf_token'] = secrets.token_hex(32)

        flash(f'Welcome back, {user.name}! 🌸', 'success')
        next_url = request.args.get('next')
        return redirect(next_url or url_for('dashboard'))

    return render_template('auth/login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if getattr(g, 'current_user', None):
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')

        # Validations
        if not name:
            flash('Please enter your name.', 'error')
            return render_template('auth/register.html', name=name, email=email)

        if not validate_email(email):
            flash('Please enter a valid email address.', 'error')
            return render_template('auth/register.html', name=name, email=email)

        is_valid_pw, pw_err = validate_password(password)
        if not is_valid_pw:
            flash(pw_err, 'error')
            return render_template('auth/register.html', name=name, email=email)

        if password != confirm_password:
            flash('Passwords do not match.', 'error')
            return render_template('auth/register.html', name=name, email=email)

        # Check existing user
        if User.query.filter_by(email=email).first():
            flash('An account with this email already exists. Please log in.', 'warning')
            return redirect(url_for('login'))

        # Create user with a unique session_token
        new_user = User(
            name=name,
            email=email,
            session_token=secrets.token_hex(32),
            avatar='🌸',
            theme_preference='system',
            voice_preference='warm',
            auto_speak=False
        )
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()

        # Seed an initial welcoming message and default Tiny Win
        default_conv = Conversation(user_id=new_user.id, title="Welcome to MoodMate")
        db.session.add(default_conv)
        db.session.flush()

        welcome_msg = ChatMessage(
            conversation_id=default_conv.id,
            sender='assistant',
            content=f"Hello {name}! 🌸 Welcome to MoodMate. I'm your gentle AI companion, and I'm so glad you're here. This is your safe, judgment-free space to share how you're feeling, reflect, or just unwind. How has your day been so far?"
        )
        first_win = TinyWin(
            user_id=new_user.id,
            title="Joined MoodMate and took the first step for my emotional wellness! 🌟",
            category="mindfulness"
        )
        db.session.add_all([welcome_msg, first_win])
        db.session.commit()

        # Initialize authenticated session bound to new user
        session.clear()
        session.permanent = True
        session['user_id'] = new_user.id
        session['session_token'] = new_user.session_token
        session['user_email'] = new_user.email
        session['user_name'] = new_user.name
        session['theme'] = new_user.theme_preference
        session['csrf_token'] = secrets.token_hex(32)

        flash(f'Account created successfully! Welcome to your sanctuary, {name}. ✨', 'success')
        return redirect(url_for('dashboard'))

    return render_template('auth/register.html')

@app.route('/logout')
def logout():
    session.clear()
    session['csrf_token'] = secrets.token_hex(32)
    flash('You have been logged out peacefully. See you soon! 🌿', 'info')
    return redirect(url_for('index'))

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        if not validate_email(email):
            flash('Please enter a valid email address.', 'error')
            return render_template('auth/reset_password.html', step='request')

        user = User.query.filter_by(email=email).first()
        # For privacy and security, don't reveal if email exists, but provide simulated secure link
        reset_token = generate_reset_token(email)
        reset_link = url_for('reset_password', token=reset_token, _external=True)
        return render_template('auth/reset_password.html', step='sent', email=email, reset_link=reset_link)

    return render_template('auth/reset_password.html', step='request')

@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    email = verify_reset_token(token)
    if not email:
        flash('The password reset link is invalid or has expired. Please request a new one.', 'error')
        return redirect(url_for('forgot_password'))

    user = User.query.filter_by(email=email).first()
    if not user:
        flash('Account not found.', 'error')
        return redirect(url_for('forgot_password'))

    if request.method == 'POST':
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')

        is_valid_pw, pw_err = validate_password(password)
        if not is_valid_pw:
            flash(pw_err, 'error')
            return render_template('auth/reset_password.html', step='reset', token=token)

        if password != confirm_password:
            flash('Passwords do not match.', 'error')
            return render_template('auth/reset_password.html', step='reset', token=token)

        user.set_password(password)
        user.refresh_session_token()
        db.session.commit()

        flash('Your password has been successfully reset! Please log in.', 'success')
        return redirect(url_for('login'))

    return render_template('auth/reset_password.html', step='reset', token=token)


# ==========================================
# MAIN APPLICATION PAGES (PROTECTED)
# ==========================================

@app.route('/dashboard')
@login_required
def dashboard():
    user = g.current_user
    user_id = user.id

    # Greeting based on time of day
    current_hour = datetime.now().hour
    if current_hour < 12:
        greeting_time = "Good morning"
    elif current_hour < 17:
        greeting_time = "Good afternoon"
    else:
        greeting_time = "Good evening"

    # Recent mood entries
    recent_moods = MoodEntry.query.filter_by(user_id=user_id).order_by(desc(MoodEntry.created_at)).limit(5).all()
    latest_mood = recent_moods[0] if recent_moods else None

    # Latest journal entry
    latest_journal = JournalEntry.query.filter_by(user_id=user_id).order_by(desc(JournalEntry.created_at)).first()

    # Recent tiny wins
    recent_wins = TinyWin.query.filter_by(user_id=user_id).order_by(desc(TinyWin.created_at)).limit(4).all()

    # Counts
    total_moods = MoodEntry.query.filter_by(user_id=user_id).count()
    total_journals = JournalEntry.query.filter_by(user_id=user_id).count()
    total_wins = TinyWin.query.filter_by(user_id=user_id).count()

    return render_template(
        'dashboard.html',
        user=user,
        greeting_time=greeting_time,
        latest_mood=latest_mood,
        recent_moods=recent_moods,
        latest_journal=latest_journal,
        recent_wins=recent_wins,
        total_moods=total_moods,
        total_journals=total_journals,
        total_wins=total_wins
    )

@app.route('/mood')
@login_required
def mood_page():
    return render_template('mood.html')

@app.route('/journal')
@login_required
def journal_page():
    return render_template('journal.html', prompts=JOURNAL_PROMPTS)

@app.route('/chat')
@login_required
def chat_page():
    voice_profiles = get_voice_profiles()
    return render_template('chat.html', voice_profiles=voice_profiles)

@app.route('/calm')
@login_required
def calm_page():
    return render_template('calm.html')

@app.route('/wins')
@login_required
def wins_page():
    return render_template('wins.html')

@app.route('/profile')
@login_required
def profile_page():
    user = g.current_user
    voice_profiles = get_voice_profiles()
    return render_template('profile.html', user=user, voice_profiles=voice_profiles)


# ==========================================
# REST API: MOOD CHECK-IN & STATS
# ==========================================

@app.route('/api/moods', methods=['GET', 'POST'])
@login_required
def api_moods():
    user_id = g.current_user.id
    if request.method == 'GET':
        limit = request.args.get('limit', 20, type=int)
        entries = MoodEntry.query.filter_by(user_id=user_id).order_by(desc(MoodEntry.created_at)).limit(limit).all()
        return jsonify([e.to_dict() for e in entries])

    data = request.get_json() or {}
    mood_type = data.get('mood_type', '').strip().lower()
    intensity = data.get('intensity', 5)
    note = data.get('note', '').strip()
    tags = data.get('tags', '')

    valid_moods = ['happy', 'okay', 'calm', 'sad', 'anxious', 'angry', 'exhausted', 'lonely', 'confused']
    if mood_type not in valid_moods:
        return jsonify({'error': 'Invalid mood selected.'}), 400

    try:
        intensity = int(intensity)
        if intensity < 1 or intensity > 10:
            intensity = 5
    except (ValueError, TypeError):
        intensity = 5

    new_entry = MoodEntry(
        user_id=user_id,
        mood_type=mood_type,
        intensity=intensity,
        note=note,
        tags=tags if isinstance(tags, str) else ', '.join(tags)
    )
    db.session.add(new_entry)
    db.session.commit()

    return jsonify({'success': True, 'entry': new_entry.to_dict()}), 201

@app.route('/api/moods/<int:entry_id>', methods=['PUT', 'DELETE'])
@login_required
def api_mood_item(entry_id):
    user_id = g.current_user.id
    entry = db.session.get(MoodEntry, entry_id)
    if not entry or entry.user_id != user_id:
        return jsonify({'error': 'Entry not found or access denied.'}), 404

    if request.method == 'DELETE':
        db.session.delete(entry)
        db.session.commit()
        return jsonify({'success': True})

    data = request.get_json() or {}
    if 'intensity' in data:
        try:
            entry.intensity = max(1, min(10, int(data['intensity'])))
        except (ValueError, TypeError):
            pass
    if 'note' in data:
        entry.note = data['note'].strip()
    if 'tags' in data:
        tags = data['tags']
        entry.tags = tags if isinstance(tags, str) else ', '.join(tags)

    db.session.commit()
    return jsonify({'success': True, 'entry': entry.to_dict()})

@app.route('/api/moods/stats')
@login_required
def api_mood_stats():
    user_id = g.current_user.id
    
    # Last 7 days trend
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_entries = MoodEntry.query.filter(
        MoodEntry.user_id == user_id,
        MoodEntry.created_at >= seven_days_ago
    ).order_by(MoodEntry.created_at.asc()).all()

    # Mood frequency
    all_entries = MoodEntry.query.filter_by(user_id=user_id).all()
    frequency = {}
    for entry in all_entries:
        frequency[entry.mood_type] = frequency.get(entry.mood_type, 0) + 1

    # Daily average intensity for chart
    dates_labels = []
    intensity_data = []
    daily_map = {}
    for entry in recent_entries:
        day_str = entry.created_at.strftime('%a, %b %d')
        if day_str not in daily_map:
            daily_map[day_str] = []
        daily_map[day_str].append(entry.intensity)

    for d, vals in daily_map.items():
        dates_labels.append(d)
        intensity_data.append(round(sum(vals) / len(vals), 1))

    # Calculate wellness reflection
    if not all_entries:
        reflection = "Welcome to MoodMate! Start by logging your first mood check-in today to uncover gentle patterns over time."
    else:
        most_common = max(frequency.items(), key=lambda x: x[1])[0]
        recent_avg = sum(e.intensity for e in recent_entries) / len(recent_entries) if recent_entries else 5.0
        if most_common in ['happy', 'calm', 'okay']:
            reflection = f"Over your check-ins, you have experienced frequent feelings of '{most_common.capitalize()}'. Continuing to celebrate small moments helps sustain this gentle equilibrium."
        else:
            reflection = f"You've been navigating moments of '{most_common.capitalize()}'. Remember to treat yourself with unconditional kindness — every feeling is valid, and you don't have to face it alone."

    return jsonify({
        'weekly_labels': dates_labels,
        'weekly_intensities': intensity_data,
        'frequency': frequency,
        'total_count': len(all_entries),
        'reflection': reflection
    })


# ==========================================
# REST API: PERSONAL JOURNAL
# ==========================================

@app.route('/api/journals', methods=['GET', 'POST'])
@login_required
def api_journals():
    user_id = g.current_user.id
    if request.method == 'GET':
        search = request.args.get('search', '').strip()
        query = JournalEntry.query.filter_by(user_id=user_id)
        if search:
            query = query.filter(
                (JournalEntry.title.ilike(f'%{search}%')) |
                (JournalEntry.content.ilike(f'%{search}%'))
            )
        entries = query.order_by(desc(JournalEntry.created_at)).all()
        return jsonify([e.to_dict() for e in entries])

    data = request.get_json() or {}
    title = data.get('title', '').strip()
    content = data.get('content', '').strip()
    mood_tag = data.get('mood_tag', '').strip()

    if not title or not content:
        return jsonify({'error': 'Please provide both title and content for your journal entry.'}), 400

    entry = JournalEntry(
        user_id=user_id,
        title=title,
        content=content,
        mood_tag=mood_tag
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify({'success': True, 'entry': entry.to_dict()}), 201

@app.route('/api/journals/<int:entry_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def api_journal_item(entry_id):
    user_id = g.current_user.id
    entry = db.session.get(JournalEntry, entry_id)
    if not entry or entry.user_id != user_id:
        return jsonify({'error': 'Journal entry not found or access denied.'}), 404

    if request.method == 'GET':
        return jsonify(entry.to_dict())

    if request.method == 'DELETE':
        db.session.delete(entry)
        db.session.commit()
        return jsonify({'success': True})

    data = request.get_json() or {}
    if 'title' in data and data['title'].strip():
        entry.title = data['title'].strip()
    if 'content' in data and data['content'].strip():
        entry.content = data['content'].strip()
    if 'mood_tag' in data:
        entry.mood_tag = data['mood_tag'].strip()

    db.session.commit()
    return jsonify({'success': True, 'entry': entry.to_dict()})

@app.route('/api/journals/prompts')
@login_required
def api_journal_prompts():
    return jsonify({'prompts': JOURNAL_PROMPTS, 'random': random.choice(JOURNAL_PROMPTS)})


# ==========================================
# REST API: TINY WINS
# ==========================================

@app.route('/api/wins', methods=['GET', 'POST'])
@login_required
def api_wins():
    user_id = g.current_user.id
    if request.method == 'GET':
        category = request.args.get('category', '').strip()
        query = TinyWin.query.filter_by(user_id=user_id)
        if category and category != 'all':
            query = query.filter_by(category=category)
        wins = query.order_by(desc(TinyWin.created_at)).all()
        return jsonify([w.to_dict() for w in wins])

    data = request.get_json() or {}
    title = data.get('title', '').strip()
    category = data.get('category', 'general').strip().lower()

    if not title:
        return jsonify({'error': 'Please provide a title for your Tiny Win.'}), 400

    new_win = TinyWin(user_id=user_id, title=title, category=category)
    db.session.add(new_win)
    db.session.commit()
    return jsonify({'success': True, 'win': new_win.to_dict()}), 201

@app.route('/api/wins/<int:win_id>', methods=['DELETE'])
@login_required
def api_delete_win(win_id):
    user_id = g.current_user.id
    win = db.session.get(TinyWin, win_id)
    if not win or win.user_id != user_id:
        return jsonify({'error': 'Win not found or access denied.'}), 404

    db.session.delete(win)
    db.session.commit()
    return jsonify({'success': True})


# ==========================================
# REST API: AI CHAT COMPANION & CONVERSATIONS
# ==========================================

@app.route('/api/conversations', methods=['GET', 'POST'])
@login_required
def api_conversations():
    user_id = g.current_user.id
    if request.method == 'GET':
        convs = Conversation.query.filter_by(user_id=user_id).order_by(desc(Conversation.updated_at)).all()
        return jsonify([c.to_dict() for c in convs])

    # POST: create new conversation
    data = request.get_json() or {}
    title = data.get('title', 'New Conversation').strip()
    new_conv = Conversation(user_id=user_id, title=title)
    db.session.add(new_conv)
    db.session.commit()

    # Initial friendly welcome greeting in new chat
    greeting_msg = ChatMessage(
        conversation_id=new_conv.id,
        sender='assistant',
        content="Hello! 🌸 I'm right here with you. What's on your mind today? Whether you want to talk through something deep, share a thought, or just relax, I'm listening."
    )
    db.session.add(greeting_msg)
    db.session.commit()

    return jsonify({'success': True, 'conversation': new_conv.to_dict(), 'welcome_message': greeting_msg.to_dict()}), 201

@app.route('/api/conversations/<int:conv_id>/messages', methods=['GET'])
@login_required
def api_conversation_messages(conv_id):
    user_id = g.current_user.id
    conv = db.session.get(Conversation, conv_id)
    if not conv or conv.user_id != user_id:
        return jsonify({'error': 'Conversation not found or access denied.'}), 404

    messages = ChatMessage.query.filter_by(conversation_id=conv_id).order_by(ChatMessage.created_at.asc()).all()
    return jsonify({
        'conversation': conv.to_dict(),
        'messages': [m.to_dict() for m in messages]
    })

@app.route('/api/conversations/<int:conv_id>', methods=['DELETE'])
@login_required
def api_delete_conversation(conv_id):
    user_id = g.current_user.id
    conv = db.session.get(Conversation, conv_id)
    if not conv or conv.user_id != user_id:
        return jsonify({'error': 'Conversation not found or access denied.'}), 404

    db.session.delete(conv)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/chat/message', methods=['POST'])
@login_required
def api_send_message():
    user_id = g.current_user.id
    data = request.get_json() or {}
    conv_id = data.get('conversation_id')
    user_message = data.get('message', '').strip()

    if not user_message:
        return jsonify({'error': 'Message content cannot be empty.'}), 400

    # Ensure conversation exists and belongs to user
    if conv_id:
        conv = db.session.get(Conversation, conv_id)
        if not conv or conv.user_id != user_id:
            return jsonify({'error': 'Invalid conversation.'}), 404
    else:
        # Create one if not provided
        conv = Conversation(user_id=user_id, title=user_message[:40] + ('...' if len(user_message) > 40 else ''))
        db.session.add(conv)
        db.session.flush()

    # Save user message
    user_msg_record = ChatMessage(conversation_id=conv.id, sender='user', content=user_message)
    db.session.add(user_msg_record)

    # If conversation title is default 'New Conversation', update it meaningfully
    if conv.title == 'New Conversation' or not conv.title:
        clean_title = user_message[:35].strip()
        conv.title = clean_title + ('...' if len(user_message) > 35 else '')

    conv.updated_at = datetime.now(timezone.utc)
    db.session.commit()

    # Fetch recent conversation history for rich multi-turn context
    history_records = ChatMessage.query.filter_by(conversation_id=conv.id).order_by(ChatMessage.created_at.asc()).all()
    history = [{'sender': m.sender, 'content': m.content} for m in history_records[:-1]]

    # Call AI Companion (Groq API or empathetic fallback)
    ai_reply_content = generate_chat_response(history, user_message)

    # Save assistant message
    assistant_msg_record = ChatMessage(conversation_id=conv.id, sender='assistant', content=ai_reply_content)
    db.session.add(assistant_msg_record)
    db.session.commit()

    return jsonify({
        'success': True,
        'conversation_id': conv.id,
        'user_message': user_msg_record.to_dict(),
        'assistant_message': assistant_msg_record.to_dict()
    })


# ==========================================
# REST API: USER SETTINGS, PROFILE & EXPORT
# ==========================================

@app.route('/api/user/profile', methods=['GET', 'PUT'])
@login_required
def api_user_profile():
    user = g.current_user
    if request.method == 'GET':
        return jsonify(user.to_dict())

    data = request.get_json() or {}
    if 'name' in data and data['name'].strip():
        user.name = data['name'].strip()
        session['user_name'] = user.name
    if 'avatar' in data:
        user.avatar = data['avatar'].strip()
    if 'theme_preference' in data and data['theme_preference'] in ['system', 'light', 'dark']:
        user.theme_preference = data['theme_preference']
        session['theme'] = user.theme_preference
    if 'voice_preference' in data:
        user.voice_preference = data['voice_preference']
    if 'voice_speed' in data:
        try:
            user.voice_speed = float(data['voice_speed'])
        except (ValueError, TypeError):
            pass
    if 'auto_speak' in data:
        user.auto_speak = bool(data['auto_speak'])

    db.session.commit()
    return jsonify({'success': True, 'user': user.to_dict()})

@app.route('/api/user/change-password', methods=['POST'])
@login_required
def api_change_password():
    user = g.current_user
    data = request.get_json() or {}
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not user.check_password(current_password):
        return jsonify({'error': 'Current password is incorrect.'}), 400

    is_valid, msg = validate_password(new_password)
    if not is_valid:
        return jsonify({'error': msg}), 400

    user.set_password(new_password)
    new_token = user.refresh_session_token()
    db.session.commit()

    # Keep current session valid with refreshed token; revokes all other devices/browsers
    session['session_token'] = new_token
    return jsonify({'success': True, 'message': 'Password updated successfully.'})

@app.route('/api/user/export', methods=['GET'])
@login_required
def api_export_user_data():
    user = g.current_user
    user_id = user.id
    moods = [m.to_dict() for m in MoodEntry.query.filter_by(user_id=user_id).all()]
    journals = [j.to_dict() for j in JournalEntry.query.filter_by(user_id=user_id).all()]
    wins = [w.to_dict() for w in TinyWin.query.filter_by(user_id=user_id).all()]

    export_payload = {
        'moodmate_export_version': '1.0',
        'export_timestamp': datetime.now(timezone.utc).isoformat(),
        'user': {
            'name': user.name,
            'email': user.email,
            'joined': user.created_at.isoformat() if user.created_at else None
        },
        'stats': {
            'total_moods': len(moods),
            'total_journals': len(journals),
            'total_tiny_wins': len(wins)
        },
        'mood_entries': moods,
        'journal_entries': journals,
        'tiny_wins': wins
    }

    response = make_response(jsonify(export_payload))
    response.headers['Content-Disposition'] = f'attachment; filename=moodmate_backup_{user.name.lower().replace(" ", "_")}.json'
    response.headers['Content-Type'] = 'application/json'
    return response

@app.route('/api/user/delete-account', methods=['POST'])
@login_required
def api_delete_account():
    user = g.current_user
    data = request.get_json() or {}
    password = data.get('password', '')

    if not user.check_password(password):
        return jsonify({'error': 'Password confirmation failed.'}), 400

    db.session.delete(user)
    db.session.commit()
    csrf = session.get('csrf_token')
    session.clear()
    if csrf:
        session['csrf_token'] = csrf
    return jsonify({'success': True, 'message': 'Your account and all associated data have been permanently deleted.'})

@app.route('/api/voice/profiles')
def api_voice_profiles():
    return jsonify({'profiles': get_voice_profiles()})

@app.route('/api/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'app': 'MoodMate',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }), 200

# Error handlers
@app.errorhandler(404)
def not_found(e):
    if request.is_json or request.path.startswith('/api/'):
        return jsonify({'error': 'Resource not found'}), 404
    return render_template('base.html', page_title="Page Not Found"), 404

@app.errorhandler(500)
def server_error(e):
    if request.is_json or request.path.startswith('/api/'):
        return jsonify({'error': 'Internal server error'}), 500
    return render_template('base.html', page_title="Server Error"), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
