"""
MoodMate — Automated Authentication & Account Isolation Test Suite
------------------------------------------------------------------
Tests cover:
1. Two separate users registration, login, and dashboard rendering.
2. Complete account isolation across moods, journals, tiny wins, and chat.
3. Prevention of cross-user access, modification, or deletion (returning 404).
4. The exact Render incident simulation: database wipe, sequential ID reuse (id=1),
   and verification that stale cookies cannot access the new user's profile.
5. Password change session revocation on other devices.
6. Cache-Control headers on authenticated pages and API routes.
7. CSRF token validation and enforcement.
"""

import os
import sys

# Ensure test suite uses a dedicated isolated SQLite test database, never touching moodmate.db
TEST_DB_PATH = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'test_suite.db')
os.environ['DATABASE_URL'] = f"sqlite:///{TEST_DB_PATH}"

import unittest
import json
from app import app
from models import db, User, MoodEntry, JournalEntry, TinyWin, Conversation, ChatMessage, ensure_schema_compatibility

class TestMoodMateAuthIsolation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        app.config['TEST_CSRF_ENFORCED'] = False
        app.config['SECRET_KEY'] = 'test-secret-key-12345'

    @classmethod
    def tearDownClass(cls):
        if os.path.exists(TEST_DB_PATH):
            try:
                os.remove(TEST_DB_PATH)
            except OSError:
                pass

    def setUp(self):
        self.app = app
        self.client = app.test_client()
        self.ctx = app.app_context()
        self.ctx.push()
        
        db.create_all()
        ensure_schema_compatibility(app)

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def register_user(self, client, name, email, password="password123"):
        return client.post('/register', data={
            'name': name,
            'email': email,
            'password': password,
            'confirm_password': password
        }, follow_redirects=True)

    def login_user(self, client, email, password="password123"):
        return client.post('/login', data={
            'email': email,
            'password': password,
            'remember': 'on'
        }, follow_redirects=True)

    def test_two_users_registration_and_distinct_identities(self):
        """Test that two separate users can register and have distinct IDs, emails, and session tokens."""
        client_a = self.app.test_client()
        client_b = self.app.test_client()

        res_a = self.register_user(client_a, "Alice Walker", "alice@example.com")
        self.assertEqual(res_a.status_code, 200)

        res_b = self.register_user(client_b, "Debargho Roy", "debargho@example.com")
        self.assertEqual(res_b.status_code, 200)

        user_a = User.query.filter_by(email="alice@example.com").first()
        user_b = User.query.filter_by(email="debargho@example.com").first()

        self.assertIsNotNone(user_a)
        self.assertIsNotNone(user_b)
        self.assertNotEqual(user_a.id, user_b.id)
        self.assertNotEqual(user_a.session_token, user_b.session_token)

    def test_complete_data_isolation_between_two_users(self):
        """Test that User B cannot view, edit, or delete User A's moods, journals, wins, or chat."""
        client_a = self.app.test_client()
        client_b = self.app.test_client()

        # Register User A & User B
        self.register_user(client_a, "Alice Walker", "alice@example.com")
        self.register_user(client_b, "Debargho Roy", "debargho@example.com")

        # Alice creates a mood entry
        res = client_a.post('/api/moods', json={
            'mood_type': 'happy',
            'intensity': 8,
            'note': 'Alice private mood note',
            'tags': 'calm, grateful'
        })
        self.assertEqual(res.status_code, 201)
        alice_mood_id = res.get_json()['entry']['id']

        # Alice creates a journal entry
        res = client_a.post('/api/journals', json={
            'title': 'Alice Secret Diary',
            'content': 'This is confidential to Alice.',
            'mood_tag': 'happy'
        })
        self.assertEqual(res.status_code, 201)
        alice_journal_id = res.get_json()['entry']['id']

        # Alice creates a tiny win
        res = client_a.post('/api/wins', json={
            'title': 'Alice ran 5km today!',
            'category': 'health'
        })
        self.assertEqual(res.status_code, 201)
        alice_win_id = res.get_json()['win']['id']

        # Alice starts a chat conversation
        res = client_a.post('/api/conversations', json={'title': 'Alice AI Therapy'})
        self.assertEqual(res.status_code, 201)
        alice_conv_id = res.get_json()['conversation']['id']

        # ----------------------------------------------------
        # Verify Debargho cannot read Alice's data via list APIs
        # ----------------------------------------------------
        res = client_b.get('/api/moods')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.get_json()), 0, "Debargho should see 0 moods")

        res = client_b.get('/api/journals')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.get_json()), 0, "Debargho should see 0 journals")

        res = client_b.get('/api/wins')
        self.assertEqual(res.status_code, 200)
        # Note: on registration 1 welcome win is created for Debargho, but none from Alice
        b_wins = res.get_json()
        for w in b_wins:
            self.assertNotEqual(w['id'], alice_win_id)

        res = client_b.get('/api/conversations')
        self.assertEqual(res.status_code, 200)
        b_convs = res.get_json()
        for c in b_convs:
            self.assertNotEqual(c['id'], alice_conv_id)

        # ----------------------------------------------------
        # Verify Debargho cannot read/modify Alice's individual items
        # ----------------------------------------------------
        # Direct GET on Alice's journal
        res = client_b.get(f'/api/journals/{alice_journal_id}')
        self.assertEqual(res.status_code, 404)

        # Direct PUT on Alice's journal
        res = client_b.put(f'/api/journals/{alice_journal_id}', json={'title': 'Hacked by B'})
        self.assertEqual(res.status_code, 404)

        # Direct DELETE on Alice's journal
        res = client_b.delete(f'/api/journals/{alice_journal_id}')
        self.assertEqual(res.status_code, 404)

        # Direct DELETE on Alice's mood
        res = client_b.delete(f'/api/moods/{alice_mood_id}')
        self.assertEqual(res.status_code, 404)

        # Direct DELETE on Alice's win
        res = client_b.delete(f'/api/wins/{alice_win_id}')
        self.assertEqual(res.status_code, 404)

        # Direct GET on Alice's conversation messages
        res = client_b.get(f'/api/conversations/{alice_conv_id}/messages')
        self.assertEqual(res.status_code, 404)

        # Direct POST message into Alice's conversation
        res = client_b.post('/api/chat/message', json={
            'conversation_id': alice_conv_id,
            'message': 'Attempting unauthorized chat intrusion'
        })
        self.assertEqual(res.status_code, 404)

        # Verify Alice's journal is still intact
        res = client_a.get(f'/api/journals/{alice_journal_id}')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['title'], 'Alice Secret Diary')

    def test_render_incident_simulation_database_wipe_and_reused_id(self):
        """
        SIMULATES THE EXACT BUG REPORTED BY THE USER:
        1. User A (Owner) registers and gets user_id=1.
        2. Database is wiped/restarted (as happens on Render's ephemeral container).
        3. Friend Debargho registers and gets user_id=1 in the new database.
        4. User A's phone reconnects with its stored cookie.
        5. VERIFY: User A is rejected and CANNOT see Debargho's account!
        """
        owner_client = self.app.test_client()

        # Step 1: Owner registers and gets user_id=1
        self.register_user(owner_client, "Owner Account", "owner@example.com")
        owner_user = User.query.filter_by(email="owner@example.com").first()
        self.assertEqual(owner_user.id, 1)

        # Step 2: Simulate Render restart / SQLite wipe
        db.session.remove()
        db.drop_all()
        ensure_schema_compatibility(self.app)

        # Step 3: Friend Debargho registers as the first user in the fresh database
        friend_client = self.app.test_client()
        self.register_user(friend_client, "Debargho", "debargho@example.com")
        debargho_user = User.query.filter_by(email="debargho@example.com").first()
        # In SQLite, the first user inserted into an empty table has ID = 1
        self.assertEqual(debargho_user.id, 1)

        # Step 4: Owner's phone connects with its previous cookie
        # Owner attempts to access dashboard
        res = owner_client.get('/dashboard')
        # Stale session must be rejected and redirected to login!
        self.assertEqual(res.status_code, 302)
        self.assertIn('/login', res.headers['Location'])

        # Owner attempts to access profile API
        res = owner_client.get('/api/user/profile')
        self.assertEqual(res.status_code, 401)
        self.assertNotIn("Debargho", res.get_data(as_text=True))

        # Follow redirect to login page and check profile is not leaked
        login_page = owner_client.get('/dashboard', follow_redirects=True)
        self.assertNotIn("Debargho", login_page.get_data(as_text=True))
        self.assertIn("Please sign in again", login_page.get_data(as_text=True))

    def test_password_change_invalidates_stale_sessions(self):
        """Test that changing password generates a new session token and revokes older sessions."""
        client_phone = self.app.test_client()
        client_laptop = self.app.test_client()

        # Register user on phone
        self.register_user(client_phone, "Clara", "clara@example.com", "oldpassword123")
        # Log in on laptop
        self.login_user(client_laptop, "clara@example.com", "oldpassword123")

        # Verify laptop is logged in
        res = client_laptop.get('/api/user/profile')
        self.assertEqual(res.status_code, 200)

        # Clara updates password on phone
        res = client_phone.post('/api/user/change-password', json={
            'current_password': 'oldpassword123',
            'new_password': 'newpassword456'
        })
        self.assertEqual(res.status_code, 200)

        # Phone remains logged in with new token
        res = client_phone.get('/api/user/profile')
        self.assertEqual(res.status_code, 200)

        # Laptop has old session token -> must be rejected as stale!
        res = client_laptop.get('/api/user/profile')
        self.assertEqual(res.status_code, 401)

    def test_cache_control_headers_on_private_endpoints(self):
        """Test that private and authenticated responses contain Cache-Control: no-store."""
        client = self.app.test_client()
        self.register_user(client, "Maya", "maya@example.com")

        res = client.get('/dashboard')
        self.assertIn('no-store', res.headers.get('Cache-Control', ''))
        self.assertEqual(res.headers.get('Pragma'), 'no-cache')

        res = client.get('/api/moods')
        self.assertIn('no-store', res.headers.get('Cache-Control', ''))

    def test_csrf_protection_enforcement(self):
        """Test that mutating requests are validated when CSRF is enforced."""
        client = self.app.test_client()
        self.register_user(client, "Zoe", "zoe@example.com")

        # Now enforce CSRF verification
        app.config['TEST_CSRF_ENFORCED'] = True

        # Mutating request without CSRF token must be rejected with 400
        res = client.post('/api/moods', json={
            'mood_type': 'calm',
            'intensity': 7
        })
        self.assertEqual(res.status_code, 400)

        # Fetch CSRF token from session
        with client.session_transaction() as sess:
            csrf_token = sess.get('csrf_token')

        # Request with valid CSRF header must succeed
        res = client.post('/api/moods', json={
            'mood_type': 'calm',
            'intensity': 7
        }, headers={'X-CSRFToken': csrf_token})
        self.assertEqual(res.status_code, 201)

        app.config['TEST_CSRF_ENFORCED'] = False

if __name__ == '__main__':
    unittest.main()
