"""
Step 3 — Transcription.
Uses OpenAI-compatible Whisper API via per-step provider config from job_config['api_providers']['transcription'].
Returns list of timed segments: [{index, start, end, duration, text}]
"""

import logging
import time
import json
import requests
from openai import OpenAI

log = logging.getLogger(__name__)

MAX_RETRIES = 2
RETRY_DELAY = 5  # seconds


def run(audio_path: str, job_config: dict, progress_fn=None) -> list:
    cfg = job_config['api_providers']['transcription']
    provider = cfg['provider']
    api_key = cfg['api_key']
    api_path = cfg['api_path'].rstrip('/')
    model = cfg['model']
    source_lang = job_config.get('source_lang', 'auto')

    if not api_key:
        raise ValueError(f"Transcription API key is missing (provider: {provider}).")
    if not api_path:
        raise ValueError(f"Transcription API base URL is missing (provider: {provider}).")

    log.info(f"[Transcription] provider={provider} model={model} lang={source_lang}")
    if progress_fn:
        progress_fn(10, f"Sending audio to {provider} / {model}...")

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            if provider == 'openrouter':
                segments = _transcribe_via_requests(
                    audio_path, api_path, api_key, model,
                    source_lang if source_lang != 'auto' else None
                )
            else:
                segments = _transcribe_via_openai_client(
                    audio_path, api_path, api_key, model,
                    source_lang if source_lang != 'auto' else None
                )

            log.info(f"Transcribed {len(segments)} segments.")
            if progress_fn:
                progress_fn(100, f"Transcribed {len(segments)} segments.")
            return segments

        except Exception as e:
            log.warning(f"Transcription attempt {attempt} failed: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)
            else:
                raise RuntimeError(f"Transcription failed after {MAX_RETRIES} attempts: {e}")

    return []


def _transcribe_via_requests(audio_path: str, api_base: str, api_key: str,
                              model: str, language: str | None) -> list:
    import base64
    url = f"{api_base}/audio/transcriptions"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    ext = audio_path.rsplit('.', 1)[-1].lower()
    if ext not in ('wav', 'mp3', 'mp4', 'm4a', 'ogg', 'flac', 'webm'):
        ext = 'wav'

    payload = {
        "model": model,
        "input_audio": {
            "data": base64.b64encode(audio_bytes).decode('utf-8'),
            "format": ext
        }
    }
    if language:
        payload["language"] = language

    # -- DEBUG LOGGING --
    log_payload = payload.copy()
    log_payload["input_audio"] = {"data": "<base64_audio_data>", "format": ext}
    log.debug(f"OpenRouter Request URL: {url}")
    log.debug(f"OpenRouter Request Payload: {json.dumps(log_payload)}")

    resp = requests.post(url, headers=headers, json=payload, timeout=300)

    log.debug(f"OpenRouter Response Status: {resp.status_code}")
    log.debug(f"OpenRouter Response Body: {resp.text[:1000]}...")
    # -------------------

    if not resp.ok:
        log.error(f"OpenRouter Error {resp.status_code}: {resp.text}")
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text}")

    # OpenRouter may return plain text or JSON depending on the model
    content_type = resp.headers.get('content-type', '')
    if 'application/json' in content_type:
        data_resp = resp.json()
        return _parse_segments_dict(data_resp)
    else:
        # Plain text response — no timing info
        text = resp.text.strip()
        log.warning("OpenRouter returned plain text (no segment timing), using as single segment")
        return [{"index": 0, "start": 0.0, "end": 0.0, "duration": 0.0, "text": text}]


def _transcribe_via_openai_client(audio_path: str, api_base: str, api_key: str,
                                   model: str, language: str | None) -> list:
    """Use the official OpenAI client for non-OpenRouter providers."""
    client = OpenAI(api_key=api_key, base_url=api_base)
    with open(audio_path, "rb") as audio_file:
        response = client.audio.transcriptions.create(
            model=model,
            file=audio_file,
            language=language,
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )
    return _parse_segments_obj(response)


def _parse_segments_dict(data: dict) -> list:
    """Parse verbose_json dict (from direct requests call)."""
    raw = data.get("segments") or []
    if raw:
        return [
            {
                "index": i,
                "start": float(seg.get("start", 0)),
                "end": float(seg.get("end", 0)),
                "duration": round(float(seg.get("end", 0)) - float(seg.get("start", 0)), 3),
                "text": seg.get("text", "").strip(),
            }
            for i, seg in enumerate(raw)
        ]
    # Fallback: no timing, single segment
    log.warning("No segments in response, using full text as single segment")
    return [{"index": 0, "start": 0.0, "end": 0.0, "duration": 0.0,
             "text": data.get("text", "").strip()}]


def _parse_segments_obj(response) -> list:
    """Parse verbose_json object (from openai client)."""
    raw = getattr(response, "segments", None) or []
    if raw:
        return [
            {
                "index": i,
                "start": float(getattr(seg, "start", seg.get("start", 0) if isinstance(seg, dict) else 0)),
                "end": float(getattr(seg, "end", seg.get("end", 0) if isinstance(seg, dict) else 0)),
                "duration": round(
                    float(getattr(seg, "end", seg.get("end", 0) if isinstance(seg, dict) else 0)) -
                    float(getattr(seg, "start", seg.get("start", 0) if isinstance(seg, dict) else 0)), 3),
                "text": (getattr(seg, "text", None) or seg.get("text", "") if isinstance(seg, dict) else "").strip(),
            }
            for i, seg in enumerate(raw)
        ]
    log.warning("No segments in response, using full text as single segment")
    text = getattr(response, "text", "") or ""
    return [{"index": 0, "start": 0.0, "end": 0.0, "duration": 0.0, "text": text.strip()}]
