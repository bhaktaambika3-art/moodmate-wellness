"""
TTS Voice Service Helper for MoodMate
Provides voice profile definitions, client guidance, and voice personality configuration.
"""

VOICE_PERSONALITIES = [
    {
        "id": "warm_female",
        "name": "Aria (Warm & Empathetic)",
        "gender": "female",
        "personality": "warm",
        "description": "Gentle, compassionate tone that feels like a close friend.",
        "pitch": 1.05,
        "rate": 0.95,
        "preferred_names": ["Google UK English Female", "Microsoft Jenny", "Microsoft Zira", "Samantha", "Victoria"]
    },
    {
        "id": "calm_male",
        "name": "Julian (Calm & Grounded)",
        "gender": "male",
        "personality": "calm",
        "description": "Steady, grounding voice suitable for relaxation and anxiety relief.",
        "pitch": 0.9,
        "rate": 0.9,
        "preferred_names": ["Google UK English Male", "Microsoft Ryan", "Microsoft David", "Alex", "Daniel"]
    },
    {
        "id": "gentle_female",
        "name": "Serena (Gentle & Soothing)",
        "gender": "female",
        "personality": "gentle",
        "description": "Soft, whispering warmth for bedtime or quiet moments.",
        "pitch": 1.0,
        "rate": 0.85,
        "preferred_names": ["Google US English", "Microsoft Sonia", "Karen", "Tessa"]
    },
    {
        "id": "cheerful_female",
        "name": "Maya (Cheerful & Encouraging)",
        "gender": "female",
        "personality": "cheerful",
        "description": "Uplifting, optimistic energy for celebrating wins.",
        "pitch": 1.15,
        "rate": 1.0,
        "preferred_names": ["Google US English", "Microsoft Jenny", "Moira"]
    }
]

def get_voice_profiles():
    return VOICE_PERSONALITIES
