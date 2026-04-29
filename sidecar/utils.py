"""
Shared utilities: temp directories, logging helpers, cost calculation.
"""

import os
import shutil
import tempfile
import logging

log = logging.getLogger(__name__)

_BASE_TEMP = os.path.join(tempfile.gettempdir(), "videodub_jobs")


def make_temp_dir(job_id: str) -> str:
    path = os.path.join(_BASE_TEMP, job_id)
    os.makedirs(path, exist_ok=True)
    log.info(f"Temp dir created: {path}")
    return path


def cleanup_temp_dir(temp_dir: str):
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir, ignore_errors=True)
        log.info(f"Temp dir removed: {temp_dir}")


def calculate_cost(job_config: dict, transcript: list) -> float:
    """Rough cost estimate based on transcript length and mode."""
    mode = job_config.get("mode", "budget")
    duration_sec = sum(seg.get("duration", 0) for seg in transcript) if transcript else 300
    mins = duration_sec / 60
    tokens = duration_sec * 15
    chars = duration_sec * 20

    transcribe = mins * 0.006
    translate = (tokens / 1000) * (0.00015 if mode == "budget" else 0.015)
    tts_cost = 0 if mode == "budget" else (chars / 1000) * 0.30

    lip_sync_enabled = job_config.get("lip_sync_enabled", False)
    lip_cost = 0
    if lip_sync_enabled and mode == "premium":
        lip_cost = duration_sec * 0.03

    return round(transcribe + translate + tts_cost + lip_cost, 4)
