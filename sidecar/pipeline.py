"""
Pipeline orchestrator — runs all 8 steps sequentially.
All AI service config is now sourced from job_config['api_providers'] per step.
"""

import os
import logging
import traceback

from steps import downloader, extractor, transcriber, translator, tts, aligner, lipsync, composer
from utils import make_temp_dir, cleanup_temp_dir

log = logging.getLogger(__name__)


def emit(event_fn, event: str, **kwargs):
    """Send a JSON-RPC event via the emit callback."""
    if event_fn:
        event_fn({"event": event, **kwargs})


def run_pipeline(job_config: dict, emit_fn=None) -> dict:
    """
    Execute the full dubbing pipeline for a job.

    job_config keys (from frontend):
      id, video_path, youtube_url, source_lang, target_lang,
      mode, lip_sync_enabled, gpu_enabled, keep_temp_files,
      api_providers: { transcription, translation, tts, lipsync }
        each: { provider, model, api_path, api_key }

    Returns result dict on success; raises on failure.
    """
    job_id = job_config.get("id", "unknown")
    lip_sync_enabled = job_config.get("lip_sync_enabled", False)
    keep_temp = job_config.get("keep_temp_files", False)

    log.info(f"=== Pipeline START: {job_id} ===")
    temp_dir = make_temp_dir(job_id)

    def progress(step: int, step_name: str, pct: int, message: str):
        emit(emit_fn, "progress", step=step, step_name=step_name, pct=pct, message=message)
        log.info(f"[Step {step}] {step_name} — {pct}% — {message}")

    try:
        # ── Step 1: Download / Load ──────────────────────────────────────────
        progress(1, "Download", 0, "Starting download...")
        video_path = downloader.run(job_config, temp_dir,
            progress_fn=lambda p, m: progress(1, "Download", p, m))

        # ── Step 2: Extract Audio ────────────────────────────────────────────
        progress(2, "Extract Audio", 0, "Extracting audio track...")
        audio_path = extractor.run(video_path, temp_dir)
        progress(2, "Extract Audio", 100, "Audio extracted.")

        # ── Step 3: Transcribe ───────────────────────────────────────────────
        progress(3, "Transcription", 0, "Transcribing speech...")
        transcript = transcriber.run(audio_path, job_config,
            progress_fn=lambda p, m: progress(3, "Transcription", p, m))

        if not transcript:
            raise RuntimeError("Transcription produced no segments.")

        # ── Step 4: Translate ────────────────────────────────────────────────
        progress(4, "Translation", 0, "Translating segments...")
        translated = translator.run(transcript, job_config,
            progress_fn=lambda p, m: progress(4, "Translation", p, m))

        # ── Step 5: TTS ──────────────────────────────────────────────────────
        progress(5, "Text-to-Speech", 0, "Synthesizing speech...")
        tts_segments = tts.run(translated, job_config, temp_dir,
            progress_fn=lambda p, m: progress(5, "Text-to-Speech", p, m))

        # ── Step 6: Align ────────────────────────────────────────────────────
        progress(6, "Audio Alignment", 0, "Aligning audio timing...")
        dubbed_audio = aligner.run(tts_segments, transcript, temp_dir,
            progress_fn=lambda p, m: progress(6, "Audio Alignment", p, m))

        # ── Step 7: Lip Sync (optional) ──────────────────────────────────────
        final_video = video_path  # default: no lip sync
        if lip_sync_enabled:
            progress(7, "Lip Sync", 0, "Running lip sync...")
            final_video = lipsync.run(video_path, dubbed_audio, job_config, temp_dir,
                progress_fn=lambda p, m: progress(7, "Lip Sync", p, m))
        else:
            progress(7, "Lip Sync", 100, "Lip sync skipped (disabled).")

        # ── Step 8: Compose ──────────────────────────────────────────────────
        progress(8, "Compose", 0, "Composing final video...")
        raw_output_path = composer.run(final_video, dubbed_audio, job_config, temp_dir)
        
        # Move the final output to the user's Videos folder so they can easily find it!
        import shutil
        home_dir = os.path.expanduser("~")
        output_dir = os.path.join(home_dir, "Videos", "VideoDubAI")
        os.makedirs(output_dir, exist_ok=True)
        
        final_filename = os.path.basename(raw_output_path)
        safe_output_path = os.path.join(output_dir, final_filename)
        shutil.move(raw_output_path, safe_output_path)
        output_path = safe_output_path

        progress(8, "Compose", 100, "Final video ready.")

        # Calculate approximate cost from segment count + duration
        total_duration = sum(s.get("duration", 0) for s in transcript)

        result = {
            "job_id": job_id,
            "output_path": output_path,
            "duration_sec": int(total_duration),
            "segment_count": len(transcript),
            "cost_usd": _estimate_cost(job_config, total_duration),
        }

        emit(emit_fn, "done", **result)
        log.info(f"=== Pipeline DONE: {job_id} → {output_path} ===")
        return result

    except Exception as e:
        err_msg = str(e)
        log.error(f"Pipeline error: {err_msg}\n{traceback.format_exc()}")
        emit(emit_fn, "error", job_id=job_id, message=err_msg)
        raise

    finally:
        if not keep_temp:
            cleanup_temp_dir(temp_dir)


def _estimate_cost(job_config: dict, duration_sec: float) -> float:
    """Rough cost estimate based on per-step providers."""
    providers = job_config.get("api_providers", {})
    mins = duration_sec / 60.0
    cost = 0.0

    # Whisper: ~$0.006/min via OpenRouter
    transcription_provider = providers.get("transcription", {}).get("provider", "openrouter")
    cost += mins * (0.006 if transcription_provider == "openrouter" else 0.004)

    # Translation: varies by model
    translation_model = providers.get("translation", {}).get("model", "")
    if "gpt-4o" in translation_model:
        cost += mins * 0.02
    elif "gemini" in translation_model:
        cost += mins * 0.002
    else:
        cost += mins * 0.005

    # TTS
    tts_provider = providers.get("tts", {}).get("provider", "kie_ai")
    cost += mins * (0.30 if tts_provider == "elevenlabs" else 0.02)

    # Lip sync
    if job_config.get("lip_sync_enabled"):
        ls_provider = providers.get("lipsync", {}).get("provider", "wav2lip")
        cost += mins * (0.50 if ls_provider == "synclabs" else 0.0)

    return round(cost, 4)
