"""
Step 3 — Transcription.
Uses OpenAI-compatible Whisper API via per-step provider config from job_config['api_providers']['transcription'].
Returns list of timed segments: [{index, start, end, duration, text}]
"""

import logging
import time
from openai import OpenAI

log = logging.getLogger(__name__)

MAX_RETRIES = 2
RETRY_DELAY = 5  # seconds


def run(audio_path: str, job_config: dict, progress_fn=None) -> list:
    cfg = job_config['api_providers']['transcription']
    provider = cfg['provider']
    api_key = cfg['api_key']
    api_path = cfg['api_path']
    model = cfg['model']
    source_lang = job_config.get('source_lang', 'auto')

    if not api_key:
        raise ValueError(f"Transcription API key is missing (provider: {provider}).")
    if not api_path:
        raise ValueError(f"Transcription API base URL is missing (provider: {provider}).")

    client = OpenAI(api_key=api_key, base_url=api_path)

    log.info(f"[Transcription] provider={provider} model={model} lang={source_lang}")
    if progress_fn:
        progress_fn(10, f"Sending audio to {provider} / {model}...")

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with open(audio_path, "rb") as audio_file:
                response = client.audio.transcriptions.create(
                    model=model,
                    file=audio_file,
                    language=source_lang if source_lang != "auto" else None,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"],
                )

            if progress_fn:
                progress_fn(80, "Processing transcript segments...")

            segments = _parse_segments(response)
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


def _parse_segments(response) -> list:
    """Parse Whisper verbose_json response into our segment format."""
    segments = []
    raw_segments = getattr(response, "segments", None) or []

    for i, seg in enumerate(raw_segments):
        start = float(seg.get("start", 0))
        end = float(seg.get("end", 0))
        segments.append({
            "index": i,
            "start": start,
            "end": end,
            "duration": round(end - start, 3),
            "text": seg.get("text", "").strip(),
        })

    return segments
