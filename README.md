# 🌸 MoodMate — AI-Powered Emotional Wellness Web Application

> **SkillX BCA Capstone Project**  
> A private, comforting sanctuary for emotional expression, mood tracking, mindful journaling, micro-achievements, and supportive AI companionship.

---

## 🌟 Overview & Purpose

**MoodMate** is a full-stack production-ready web application created to provide a safe, soothing, and judgment-free digital space. Unlike generic chatbots, MoodMate combines empathetic conversational AI with practical wellness tools:
- **Daily Dashboard**: Personalized greetings, reflections, and quick mood check-ins.
- **Mood Tracker & Insights**: 9-emotion emoji selector with 1–10 intensity slider, tags, reflection notes, and interactive **Chart.js** 7-day trend and breakdown analytics.
- **Personal Journal**: Distraction-free writing space with writing prompts, word count, reading time, auto-saving drafts, search, and full read/edit modals.
- **Talk to MoodMate (Groq AI)**: Intelligent, empathetic conversational companion using Groq API (`openai/gpt-oss-120b` or `llama-3.3-70b-versatile`) with multi-turn memory, safety crisis helplines (Tele-MANAS, 988), and multi-lingual support (English, Hindi, Bengali).
- **Customizable AI Voices**: Speech-to-Text (STT) mic input, Text-to-Speech (TTS) natural voices (Aria, Julian, Serena, Maya), speaking speed controls, and audio playback toggles.
- **Calm Corner**: Guided box breathing (4-4-4-4, 4-7-8, 5-5) with animated visualizer & audio cues, 100% procedural Web Audio API soundscapes (Rain, Ocean, Forest, Fireplace), and 5-4-3-2-1 grounding exercises.
- **Tiny Wins**: Micro-achievement celebration with confetti bursts, category filtering, and encouragement streaks.
- **User Settings & Privacy**: Isolated user accounts, avatar customization, dark/light theme toggle, data export (JSON backup), and secure password hashing.

---

## 🛠️ Technology Stack & Architecture

- **Backend**: Python 3, Flask, Flask-SQLAlchemy, Werkzeug Security, Gunicorn
- **Frontend**: Semantic HTML5, Vanilla CSS3 (Custom Design System with Soft Lavender & Sage Palette), JavaScript (ES6+)
- **Database**: 
  - Local / Development: SQLite (`moodmate.db`)
  - Production (Render): PostgreSQL (via `psycopg2-binary`)
- **AI Integration**: Groq API (High-speed conversational inference with fallbacks and crisis safety guardrails)
- **Voice Engine**: Web Speech API (SpeechRecognition STT + SpeechSynthesis TTS) with customizable personality profiles
- **Procedural Audio**: Web Audio API (Synthesizes natural rain, ocean, wind, and fireplace sounds dynamically in the browser without external audio files)
- **Visuals & Charts**: Chart.js (Line & Doughnut charts), Canvas Confetti, FontAwesome 6, Google Fonts (*Plus Jakarta Sans* & *Outfit*)

---

## 📁 Project Structure

```
moodmate/
│
├── app.py                  # Main Flask application & REST API routes
├── config.py               # Environment configuration & DB URI converter
├── models.py               # SQLAlchemy models (User, MoodEntry, JournalEntry, TinyWin, Conversation, ChatMessage)
├── groq_service.py         # Groq API client, prompt engineering, crisis detector & empathetic fallback
├── tts_service.py          # Voice personality profiles & TTS helpers
├── utils.py                # Auth decorators, validations, timed reset tokens, quotes & prompts
│
├── templates/              # Jinja2 HTML Templates
│   ├── base.html           # Master layout with responsive sidebar, topbar & bottom nav
│   ├── index.html          # Public landing & feature showcase page
│   ├── dashboard.html      # Main user dashboard with quick check-in widget
│   ├── mood.html           # Mood tracker, history timeline & Chart.js analytics
│   ├── journal.html        # Distraction-free personal journal & read modal
│   ├── chat.html           # Real-time AI chat companion with voice STT & TTS
│   ├── calm.html           # Guided breathing, procedural soundscapes & grounding
│   ├── wins.html           # Tiny Wins celebration with confetti bursts
│   ├── profile.html        # Profile settings, avatar selection, voice & data export
│   └── auth/               # Authentication views
│       ├── login.html
│       ├── register.html
│       └── reset_password.html
│
├── static/
│   ├── css/                # Custom CSS design system (Light & Dark theme)
│   │   ├── style.css       # Master stylesheet, CSS variables, typography & layout
│   │   ├── dashboard.css   # Dashboard cards & check-in styles
│   │   ├── chat.css        # AI chat layout, speech bubbles & mic animation
│   │   ├── calm.css        # Breathing visualizer ring & soundscape mixers
│   │   ├── journal.css     # Writing space, search & modal
│   │   └── wins.css        # Celebration banner & category badges
│   └── js/                 # Client-side interactivity
│       ├── main.js         # Theme switcher (Light/Dark/System) & mobile drawer
│       ├── dashboard.js    # Quick check-in widget & API connector
│       ├── mood.js         # Mood submission & Chart.js graph rendering
│       ├── journal.js      # Autosave, word count, prompts & search filter
│       ├── chat.js         # AI conversation client, voice STT & TTS controller
│       ├── calm.js         # Guided breathing timer & Web Audio sound generators
│       ├── wins.js         # Confetti trigger & Tiny Wins management
│       └── profile.js      # User profile, voice preview & data backup
│
├── requirements.txt        # Production dependencies
├── Procfile                # Gunicorn startup for cloud platforms (Render/Heroku)
├── render.yaml             # Render Blueprint specification (Web Service + PostgreSQL)
├── .env.example            # Environment variables template
└── .gitignore              # Ignored files (virtualenv, database, cache)
```

---

## 🚀 Local Development Setup

### Step 1: Navigate to the Project Directory
Open PowerShell or your preferred terminal:
```powershell
cd C:\Users\bhakt\.gemini\antigravity\scratch\moodmate
```

### Step 2: Install Dependencies
```powershell
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
Create a `.env` file in the project folder:
```env
SECRET_KEY=moodmate-super-secret-key-2026
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
PORT=5000
```
> **Tip:** You can obtain a free Groq API key in 30 seconds at [https://console.groq.com/keys](https://console.groq.com/keys). If you do not provide a key, MoodMate automatically activates its built-in empathetic local response engine!

### Step 4: Run the Application
```powershell
python app.py
```
Open your browser and navigate to:
```
http://localhost:5000
```

---

## 🌐 Public Deployment Guide (Render + GitHub)

To share MoodMate with classmates, teachers, and friends over WhatsApp so they can access it on their phones without installing anything:

### Phase 1: Create a GitHub Account & Repository
1. Go to [https://github.com/join](https://github.com/join) and create a free account.
2. In the top right corner, click **+** &rarr; **New repository**.
3. Name your repository: `moodmate-wellness`.
4. Choose **Public** and do not add a README (we already have one). Click **Create repository**.
5. Upload your project files or push using git:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of MoodMate application"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/moodmate-wellness.git
   git push -u origin main
   ```
   *(Alternatively, use GitHub Desktop or the "uploading an existing file" link on the repository page to drag and drop the files)*.

### Phase 2: Deploy on Render
1. Log in to your Render account at [https://dashboard.render.com](https://dashboard.render.com).
2. Click **New +** &rarr; **Web Service**.
3. Select **Connect a repository** and choose your `moodmate-wellness` repository.
4. Fill in the service details:
   - **Name**: `moodmate-wellness` (or your preferred name)
   - **Region**: Closest to you (e.g., Singapore or Frankfurt)
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
   - **Instance Type**: `Free`
5. Click **Advanced** &rarr; **Add Environment Variable**:
   - `SECRET_KEY`: `any-long-random-string-12345`
   - `GROQ_API_KEY`: `your_groq_api_key_here`
   - `GROQ_MODEL`: `openai/gpt-oss-120b`
   - `PYTHON_VERSION`: `3.11.9`
6. *(Optional PostgreSQL Database)*:
   - Click **New +** &rarr; **PostgreSQL**.
   - Create a free database named `moodmate-db`.
   - Copy the **Internal Database URL** and add it as `DATABASE_URL` in your Web Service environment variables.
7. Click **Create Web Service**.
8. Render will build and deploy MoodMate in 2–3 minutes. Once complete, you will receive a public HTTPS URL such as:
   ```
   https://moodmate-wellness.onrender.com
   ```
   You can immediately share this link via WhatsApp!

---

## 🎓 BCA SkillX Viva & Evaluation Q&A Cheat Sheet

| Question | Answer for Examiner / Viva |
|---|---|
| **What problem does MoodMate solve?** | MoodMate bridges the gap between daily emotional distress and inaccessible mental health resources by offering a comforting, non-stigmatizing digital companion that facilitates mood tracking, mindful reflection, and grounding. |
| **Why use Flask over Django or React?** | Flask is a lightweight micro-framework that provides full architectural control with minimal overhead. It allows clean separation of concerns, fast deployment, and native Jinja2 templating without the complexity of a separate client build pipeline. |
| **How does AI conversation memory work?** | In `app.py` and `groq_service.py`, each message is stored in the `chat_messages` table tied to a `conversation_id`. When a user sends a message, the server fetches the last 10 messages from the database and passes them as chronological role-based context (`user` and `assistant`) to the Groq API. |
| **How is user data kept private?** | Every database query (moods, journals, wins, chats) is strictly scoped using `user_id = session['user_id']`. Passwords are encrypted using Werkzeug's cryptographic PBKDF2/scrypt hashing. One user cannot access another user's records. |
| **How do procedural ambient sounds work without MP3s?** | The app utilizes the browser's native **Web Audio API**. It mathematically generates audio waves (white and pink noise, low-frequency oscillators, and biquad filters) in real time to simulate rain, ocean swells, and fireplace crackles with zero network bandwidth. |
| **What safety protocols are implemented for mental health?** | MoodMate includes keyword detection for self-harm and crisis situations (`check_crisis_indicator` in `groq_service.py`). When triggered, it immediately presents compassionate crisis intervention and displays verified 24/7 helplines (Tele-MANAS `14416`, KIRAN, and `988`). |

---

## 🌸 Author & Credits
- **Project**: MoodMate — AI Emotional Wellness Companion
- **Student**: BCA Candidate (SkillX Project Initiative)
- **Year**: 2026
