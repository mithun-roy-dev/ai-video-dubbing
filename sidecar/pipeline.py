"""
Pipeline Orchestrator — runs all 8 steps in sequence.
"""

import time
import logging
from typing import Callable
from steps import downloader, extractor, transcriber, translator, tts, aligner, lipsync, composer
from config import get_service_config
from utils import make_temp_dir, cleanup_temp_dir, calculate_cost

log = logging.getLogger(__name__)


def run_pipeline(job_config: dict, emit_fn: Callable) -> dict:
    job_id = job_config["id"]
    mode = job_config["mode"]               # "budget" | "premium"
    lip_sync = job_config["lip_sync_enabled"]
    api_keys = job_config["api_keys"]
    keep_temp = job_config.get("keep_temp_files", False)

    service_cfg = get_service_config(mode, api_keys)
    temp_dir = make_temp_dir(job_id)
    start_time = time.time()

    def progress(step: int, name: str, pct: int, message: str = ""):
        emit_fn({
            "id": job_id,
            "event": "progress",
            "step": step,
            "step_name": name,
            "pct": pct,
            "message": message or f"Step {step}: {name}",
        })

    try:
        # Step 1 — Download / Load
        progress(1, "Download", 0, "Acquiring video...")
        video_path = downloader.run(job_config, temp_dir)
        progress(1, "Download", 100, "Video ready.")

        # Step 2 — Audio Extraction
        progress(2, "Extract Audio", 0, "Extracting audio track...")
        audio_path = extractor.run(video_path, temp_dir)
        progress(2, "Extract Audio", 100, "Audio extracted.")

        # Step 3 — Transcription
        progress(3, "Transcribe", 0, "Transcribing audio...")
        transcript = transcriber.run(audio_path, job_config, service_cfg, progress_fn=lambda pct, msg: progress(3, "Transcribe", pct, msg))
        progress(3, "Transcribe", 100, f"Transcribed {len(transcript)} segments.")

        # Step 4 — Translation
        progress(4, "Translate", 0, "Translating segments...")
        translated = translator.run(transcript, job_config, service_cfg, progress_fn=lambda pct, msg: progress(4, "Translate", pct, msg))
        progress(4, "Translate", 100, "Translation complete.")

        # Step 5 — TTS
        progress(5, "Text-to-Speech", 0, "Generating dubbed audio...")
        tts_segments = tts.run(translated, job_config, service_cfg, temp_dir, progress_fn=lambda pct, msg: progress(5, "Text-to-Speech", pct, msg))
        progress(5, "Text-to-Speech", 100, "TTS audio generated.")

        # Step 6 — Timing Alignment
        progress(6, "Align Timing", 0, "Aligning audio timing...")
        dubbed_audio = aligner.run(tts_segments, transcript, temp_dir, progress_fn=lambda pct, msg: progress(6, "Align Timing", pct, msg))
        progress(6, "Align Timing", 100, "Audio aligned.")

        # Step 7 — Lip Sync (optional)
        if lip_sync:
            progress(7, "Lip Sync", 0, "Running lip sync...")
            video_path = lipsync.run(video_path, dubbed_audio, job_config, service_cfg, temp_dir, progress_fn=lambda pct, msg: progress(7, "Lip Sync", pct, msg))
            progress(7, "Lip Sync", 100, "Lip sync complete.")

        # Step 8 — Compose
        progress(8, "Compose", 0, "Composing final video...")
        output_path = composer.run(video_path, dubbed_audio, job_config, temp_dir)
        progress(8, "Compose", 100, "Final video ready!")

        duration_sec = int(time.time() - start_time)
        cost = calculate_cost(job_config, transcript)

        return {
            "output_path": output_path,
            "cost_usd": cost,
            "duration_sec": duration_sec,
        }

    except Exception:
        log.exception(f"[{job_id}] Pipeline failed")
        raise
    finally:
        if not keep_temp:
            cleanup_temp_dir(temp_dir)
            log.info(f"[{job_id}] Temp files cleaned up")
