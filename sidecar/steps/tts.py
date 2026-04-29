"""
Step 5 — Text-to-Speech.
Uses per-step provider config from job_config['api_providers']['tts'].
Supported providers: kie_ai, elevenlabs
"""

import os
import logging
import requests

log = logging.getLogger(__name__)

# ElevenLabs default voice — "Adam" (multilingual)
ELEVENLABS_DEFAULT_VOICE = "pNInz6obpgDQGcFmaJgB"


def run(translated: list, job_config: dict, temp_dir: str, progress_fn=None) -> list:
    cfg = job_config['api_providers']['tts']
    provider = cfg['provider']
    api_key = cfg['api_key']
    api_path = cfg['api_path']
    model = cfg['model']
    target_lang = job_config.get("target_lang", "en")

    # If the UI passed a KIE AI or ElevenLabs key for OpenRouter, fallback to transcription key
    if provider == "openrouter" and (not api_key or not api_key.startswith("sk-or")):
        tr_key = job_config.get('api_providers', {}).get('transcription', {}).get('api_key', '')
        if tr_key.startswith("sk-or"):
            log.info("TTS step: OpenRouter provider selected but invalid key found. Falling back to transcription OpenRouter key.")
            api_key = tr_key

    segments_with_audio = []
    total = len(translated)

    for i, seg in enumerate(translated):
        text = seg.get("translated_text") or seg.get("text", "")
        if not text.strip():
            log.warning(f"Segment {i} has empty text, skipping TTS.")
            continue

        out_path = os.path.join(temp_dir, f"tts_{i:04d}.wav")

        log.debug(f"TTS segment {i+1}/{total}: provider={provider} model={model}")

        if provider == "kie_ai":
            _tts_kie_ai(text, target_lang, api_key, api_path, model, out_path)
        elif provider == "elevenlabs":
            _tts_elevenlabs(text, api_key, api_path, model, out_path)
        elif provider == "openrouter":
            _tts_openrouter(text, api_key, api_path, model, out_path)
        else:
            raise ValueError(f"Unknown TTS provider: {provider}")

        segments_with_audio.append({**seg, "tts_path": out_path})

        if progress_fn:
            pct = int(((i + 1) / total) * 100)
            progress_fn(pct, f"TTS segment {i + 1}/{total}")

    log.info(f"TTS complete: {len(segments_with_audio)} audio segments")
    return segments_with_audio


def _tts_kie_ai(text: str, lang: str, api_key: str, api_path: str, model: str, out_path: str):
    if not api_key:
        raise ValueError("KIE AI API key is missing.")

    base = api_path.rstrip("/") or "https://api.kie.ai/v1"
    url = f"{base}/tts"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {"text": text, "language": lang, "model": model, "format": "wav"}

    log.debug(f"KIE AI Request URL: {url}")
    log.debug(f"KIE AI Request Payload: {payload}")

    resp = requests.post(url, json=payload, headers=headers, timeout=60)

    log.debug(f"KIE AI Response Status: {resp.status_code}")

    if resp.status_code != 200:
        log.error(f"KIE AI Error {resp.status_code}: {resp.text[:500]}")
        raise RuntimeError(f"KIE AI TTS error {resp.status_code}: {resp.text[:200]}")

    with open(out_path, "wb") as f:
        f.write(resp.content)


def _tts_elevenlabs(text: str, api_key: str, api_path: str, model: str, out_path: str):
    if not api_key:
        raise ValueError("ElevenLabs API key is missing.")

    base = api_path.rstrip("/") or "https://api.elevenlabs.io/v1"
    voice_id = ELEVENLABS_DEFAULT_VOICE
    url = f"{base}/text-to-speech/{voice_id}"

    headers = {"xi-api-key": api_key, "Content-Type": "application/json"}
    payload = {
        "text": text,
        "model_id": model or "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }

    log.debug(f"ElevenLabs Request URL: {url}")
    log.debug(f"ElevenLabs Request Payload: {payload}")

    resp = requests.post(url, json=payload, headers=headers, timeout=60)

    log.debug(f"ElevenLabs Response Status: {resp.status_code}")

    if resp.status_code != 200:
        log.error(f"ElevenLabs Error {resp.status_code}: {resp.text[:500]}")
        raise RuntimeError(f"ElevenLabs TTS error {resp.status_code}: {resp.text[:200]}")

    with open(out_path, "wb") as f:
        f.write(resp.content)


def _tts_openrouter(text: str, api_key: str, api_path: str, model: str, out_path: str):
    if not api_key:
        raise ValueError("OpenRouter API key is missing.")

    base = api_path.rstrip("/") or "https://openrouter.ai/api/v1"
    url = f"{base}/audio/speech"

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "model": model or "openai/gpt-4o-mini-tts-2025-12-15",
        "input": text,
        "voice": "alloy",
        "response_format": "mp3"
    }

    log.debug(f"OpenRouter TTS Request URL: {url}")
    log.debug(f"OpenRouter TTS Request Payload: {payload}")

    resp = requests.post(url, json=payload, headers=headers, timeout=60)

    log.debug(f"OpenRouter TTS Response Status: {resp.status_code}")

    if resp.status_code != 200:
        log.error(f"OpenRouter TTS Error {resp.status_code}: {resp.text[:500]}")
        raise RuntimeError(f"OpenRouter TTS error {resp.status_code}: {resp.text[:200]}")

    with open(out_path, "wb") as f:
        f.write(resp.content)
