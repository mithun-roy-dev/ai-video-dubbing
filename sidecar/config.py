"""
Service configuration for Budget and Premium modes.
"""

BUDGET_CONFIG = {
    "transcription": {
        "provider": "openrouter",
        "model": "openai/whisper-large-v3",
        "base_url": "https://openrouter.ai/api/v1",
    },
    "translation": {
        "provider": "openrouter",
        "model": "google/gemini-2.0-flash-exp",
        "base_url": "https://openrouter.ai/api/v1",
    },
    "tts": {
        "provider": "kie_ai",
    },
    "lipsync": {
        "provider": "wav2lip",
    },
}

PREMIUM_CONFIG = {
    "transcription": {
        "provider": "openrouter",
        "model": "openai/whisper-large-v3",
        "base_url": "https://openrouter.ai/api/v1",
    },
    "translation": {
        "provider": "openrouter",
        "model": "openai/gpt-4o",
        "base_url": "https://openrouter.ai/api/v1",
    },
    "tts": {
        "provider": "elevenlabs",
        "model": "eleven_multilingual_v2",
        "tts_api_url": "https://api.elevenlabs.io/v1/text-to-speech",
    },
    "lipsync": {
        "provider": "synclabs",
        "api_url": "https://api.sync.so/v2/generate",
        "model": "lipsync-2",
        "poll_interval_sec": 5,
        "timeout_sec": 600,
    },
}


def get_service_config(mode: str, api_keys: dict) -> dict:
    base = BUDGET_CONFIG if mode == "budget" else PREMIUM_CONFIG
    return {**base, "api_keys": api_keys}
