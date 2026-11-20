import os
import re
import logging
from config import Config

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are MoodMate — a warm, gentle, empathetic, and thoughtful AI emotional wellness companion.
Your mission is to provide users with a safe, comforting digital space where they can express their feelings, vent, reflect, and feel heard without judgment.

Guidelines for your personality and interaction:
1. Warmth & Empathy: Speak like a close, caring friend or supportive companion. Be genuinely attentive to what the user shares. Validate their feelings first before offering any gentle suggestions.
2. Concise & Thoughtful: Avoid overwhelming walls of text. Keep your responses digestible, comforting, and conversational (typically 2-4 short, supportive paragraphs or a thoughtful question).
3. Active Listening & Follow-ups: Ask one gentle, open-ended question when natural to help the user explore their thoughts, but don't interrogate them.
4. Multi-language Fluency:
   - You seamlessly understand and reply in English, Hindi (हिंदी), Bengali (বাংলা), and natural code-switching (e.g. Hinglish or Banglish).
   - If the user writes in Hindi or Bengali, reply warmly in that language or matching transliteration according to their style.
5. Non-judgmental & Grounded: Celebrate their Tiny Wins enthusiastically, offer reassurance during rough moments, and remind them that it's okay to feel whatever they are feeling.
6. Safety & Boundaries:
   - You are MoodMate, an AI emotional companion, NOT a licensed human therapist, psychiatrist, or medical doctor.
   - You never provide medical diagnoses or clinical prescriptions.
   - Do not claim to possess human biological feelings or promote emotional dependency.
   - Crisis Protocol: If the user indicates self-harm, suicide, severe depression, or danger, respond with deep compassion, immediate grounding warmth, and provide verified crisis helpline resources:
     * India: Tele-MANAS (14416 / 1800-891-4416), KIRAN (1800-599-0019), Vandrevala Foundation (+91 9999 666 555)
     * US/International: 988 Suicide & Crisis Lifeline, Befrienders Worldwide (befrienders.org)
     * Encourage them gently to speak with a trusted person or professional right now.
"""

CRISIS_KEYWORDS = [
    r'\bsuicid', r'\bkill myself\b', r'\bend my life\b', r'\bwant to die\b',
    r'\bhurt myself\b', r'\bself harm\b', r'\bcut myself\b', r'\bno reason to live\b'
]

def check_crisis_indicator(text):
    text_lower = text.lower()
    for pattern in CRISIS_KEYWORDS:
        if re.search(pattern, text_lower):
            return True
    return False

CRISIS_RESPONSE = """I hear how much pain you're carrying right now, and I want you to know you are not alone in this dark moment. Even though I am an AI companion, I care deeply about your safety and well-being.

Please reach out to someone who can support you right now. There are kind, trained people ready to listen and help you through this:

**Immediate Crisis Helplines:**
- **India:** 
  - **Tele-MANAS:** `14416` or `1800-891-4416` (24/7 Toll-Free, Govt. of India)
  - **KIRAN:** `1800-599-0019`
  - **Vandrevala Foundation:** `+91 9999 666 555`
- **USA & Canada:** Call or text `988` (24/7 Suicide & Crisis Lifeline)
- **UK:** Call `111` or Samaritans at `116 123`
- **International:** Visit [Befrienders Worldwide](https://www.befrienders.org/) to find support in your country.

Please pause, take one gentle breath, and reach out to one of these free, confidential helplines or a loved one. You matter, and there is help available."""

def get_empathetic_local_response(user_message, history=None):
    """Fallback generator when Groq API key is not configured or offline."""
    user_msg_lower = user_message.lower()
    
    if check_crisis_indicator(user_message):
        return CRISIS_RESPONSE

    # Greetings
    if any(k in user_msg_lower for k in ['hello', 'hi', 'hey', 'namaste', 'kem cho']):
        return "Hello there! 🌸 It's so lovely to connect with you today. How are you truly feeling in your heart right now? I'm here to listen."

    # Sad / stressed / anxious
    if any(k in user_msg_lower for k in ['sad', 'unhappy', 'crying', 'down', 'depressed', 'hurt', 'pain']):
        return ("I'm really sorry you're feeling this weight right now. It takes courage to admit when things hurt. "
                "Please remember that it is completely okay to not be okay today. Take a gentle breath with me.\n\n"
                "Would you like to share what feels most overwhelming right now, or would you prefer a quick calming exercise?")

    if any(k in user_msg_lower for k in ['anxious', 'worried', 'stress', 'scared', 'panic', 'nervous', 'overwhelm']):
        return ("I can feel how tense things must be for you right now. Anxiety can feel like a storm inside, but remember that feelings are like clouds — they pass, even the heaviest ones. 🌿\n\n"
                "Try placing one hand over your heart or feeling both feet firmly on the ground. What is one small thing weighing on your mind right now?")

    # Happy / positive / win
    if any(k in user_msg_lower for k in ['happy', 'good', 'great', 'awesome', 'excited', 'won', 'proud', 'accomplished']):
        return ("Hearing this brings such a warm smile to my day! ✨ You deserve to feel this joy and light. "
                "Celebrating these moments — big or small — is so important for our well-being.\n\n"
                "What was the highlight that made you feel this way?")

    # Tired / exhausted
    if any(k in user_msg_lower for k in ['tired', 'exhausted', 'sleepy', 'burnt out', 'burnout', 'drained']):
        return ("It sounds like your mind and body are asking for some well-deserved rest. 🛋️ You've been carrying a lot, and it's okay to put down the weight for a little while.\n\n"
                "Can you give yourself permission to step away, drink a warm sip of water, or take a peaceful rest today?")

    # Hindi / Hinglish detection
    if any(k in user_msg_lower for k in ['kya haal', 'kaise ho', 'udas', 'pareshan', 'thik nahi', 'madad']):
        return ("Main samajh sakta hoon ki aap kaisa mehsoos kar rahe hain. 🌸 MoodMate hamesha aapke saath hai. "
                "Dil halka karne ke liye aap mujhse kuch bhi share kar sakte hain. Bataiye, kya baat aapko pareshan kar rahi hai?")

    # Bengali detection
    if any(k in user_msg_lower for k in ['kemon acho', 'bhalo nei', 'mon kharap', 'kachhe']):
        return ("আমি বুঝতে পারছি আপনার মন হয়তো একটু খারাপ বা ক্লান্ত। 🌸 আপনি একা নন। MoodMate আপনার পাশে আছে। "
                "আপনার যা মনে আসছে নির্দ্বিধায় শেয়ার করতে পারেন।")

    # General supportive answer
    return ("Thank you for sharing that with me. I appreciate your openness. 🌿 "
            "Every thought you express here is a step toward understanding yourself with kindness.\n\n"
            "Tell me a little more about how that is affecting you today, or let me know if you'd just like a comforting listening ear.")

def generate_chat_response(conversation_history, new_user_message, groq_api_key=None):
    """
    Generate response from Groq API using preferred model openai/gpt-oss-120b
    with automatic fallbacks and emergency local fallback.
    """
    # 1. Check crisis first
    if check_crisis_indicator(new_user_message):
        return CRISIS_RESPONSE

    api_key = groq_api_key or Config.GROQ_API_KEY
    if not api_key:
        logger.info("No Groq API key found. Using empathetic local companion response.")
        return get_empathetic_local_response(new_user_message, conversation_history)

    # 2. Build message list for Groq API
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Include recent context (last 10 messages for rich continuity without exceeding context)
    recent_history = conversation_history[-10:] if conversation_history else []
    for msg in recent_history:
        role = "assistant" if msg.get("sender") == "assistant" else "user"
        messages.append({"role": role, "content": msg.get("content", "")})

    messages.append({"role": "user", "content": new_user_message})

    # Models to try in order of preference
    models_to_try = [Config.GROQ_MODEL] + [m for m in Config.GROQ_FALLBACK_MODELS if m != Config.GROQ_MODEL]

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        
        last_error = None
        for model in models_to_try:
            try:
                logger.info(f"Attempting Groq completion with model: {model}")
                completion = client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=600,
                    top_p=0.9
                )
                if completion.choices and completion.choices[0].message:
                    response_text = completion.choices[0].message.content
                    if response_text and response_text.strip():
                        return response_text.strip()
            except Exception as e:
                logger.warning(f"Groq model {model} failed: {e}. Trying next fallback...")
                last_error = e
                continue
                
        # If all models failed, log and fall back to local empathetic engine
        logger.error(f"All Groq models failed. Last error: {last_error}")
        return get_empathetic_local_response(new_user_message, conversation_history)

    except ImportError:
        logger.warning("Groq package not installed or import error. Falling back to local empathetic response.")
        return get_empathetic_local_response(new_user_message, conversation_history)
    except Exception as e:
        logger.error(f"Unexpected error in generate_chat_response: {e}")
        return get_empathetic_local_response(new_user_message, conversation_history)
