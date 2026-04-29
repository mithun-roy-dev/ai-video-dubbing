"""
Step 5 — Text-to-Speech.
Budget: KIE AI TTS API
Premium: ElevenLabs Multilingual v2
"""

import os
import logging
import requests

log = logging.getLogger(__name__)

# ElevenLabs voice IDs that support multilingual v2
# User can override via settings; these are sensible defaults
ELEVENLABS_DEFAULT_VOICE = "pNInz6obpgDQGcFmaJgB"  # "Adam" — multilingual


def run(translated: list, job_config: dict, service_cfg: dict, temp_dir: str, progress_fn=None) -> list:
    provider = service_cfg["tts"]["provider"]
    api_keys = service_cfg["api_keys"]
    target_lang = job_config.get("target_lang", "en")

    segments_with_audio = []
    total = len(translated)

    for i, seg in enumerate(translated):
        text = seg.get("translated_text") or seg.get("text", "")
        if not text.strip():
            log.warning(f"Segment {i} has empty text, skipping TTS.")
            continue

        out_path = os.path.join(temp_dir, f"tts_{i:04d}.wav")

        if provider == "kie_ai":
            _tts_kie_ai(text, target_lang, api_keys["kie_ai"], out_path)
        elif provider == "elevenlabs":
            _tts_elevenlabs(text, target_lang, api_keys["elevenlabs"], service_cfg["tts"], out_path)
        else:
            raise ValueError(f"Unknown TTS provider: {provider}")

        segments_with_audio.append({**seg, "tts_path": out_path})

        if progress_fn:
            pct = int(((i + 1) / total) * 100)
            progress_fn(pct, f"TTS segment {i + 1}/{total}")

    log.info(f"TTS complete: {len(segments_with_audio)} audio segments")
    return segments_with_audio


def _tts_kie_ai(text: str, lang: str, api_key: str, out_path: str):
    """KIE AI TTS — check kie.ai docs for current endpoint."""
    if not api_key:
        raise ValueError("KIE AI API key is missing.")

    # NOTE: Verify endpoint at https://kie.ai/dashboard — may require update
    url = "https://api.kie.ai/v1/tts"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"text": text, "language": lang, "format": "wav"}

    resp = requests.post(url, json=payload, headers=headers, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"KIE AI TTS error {resp.status_code}: {resp.text[:200]}")

    with open(out_path, "wb") as f:
        f.write(resp.content)


def _tts_elevenlabs(text: str, lang: str, api_key: str, tts_cfg: dict, out_path: str):
    """ElevenLabs Multilingual v2 TTS."""
    if not api_key:
        raise ValueError("ElevenLabs API key is missing.")

    voice_id = ELEVENLABS_DEFAULT_VOICE
    model_id = tts_cfg.get("model", "eleven_multilingual_v2")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

    headers = {"xi-api-key": api_key, "Content-Type": "application/json"}
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    resp = requests.post(url, json=payload, headers=headers, timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"ElevenLabs TTS error {resp.status_code}: {resp.text[:200]}")

    with open(out_path, "wb") as f:
        f.write(resp.content)
