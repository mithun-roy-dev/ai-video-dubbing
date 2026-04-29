"""
Step 3 — Transcription.
Uses OpenAI-compatible Whisper API via OpenRouter.
Returns list of timed segments: [{index, start, end, duration, text}]
"""

import os
import logging
import time
from openai import OpenAI

log = logging.getLogger(__name__)

MAX_RETRIES = 2
RETRY_DELAY = 5  # seconds


def run(audio_path: str, job_config: dict, service_cfg: dict, progress_fn=None) -> list:
    cfg = service_cfg["transcription"]
    api_key = service_cfg["api_keys"]["openrouter"]
    source_lang = job_config.get("source_lang", "auto")

    if not api_key:
        raise ValueError("OpenRouter API key is missing.")

    client = OpenAI(
        api_key=api_key,
        base_url=cfg["base_url"],
    )

    log.info(f"Transcribing with model: {cfg['model']}, language: {source_lang}")
    if progress_fn:
        progress_fn(10, "Sending audio to Whisper API...")

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with open(audio_path, "rb") as audio_file:
                response = client.audio.transcriptions.create(
                    model=cfg["model"],
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
