"""
Step 7 — Lip Sync (Optional).
Uses per-step provider config from job_config['api_providers']['lipsync'].
Supported providers: wav2lip, synclabs
"""

import os
import time
import logging
import requests

log = logging.getLogger(__name__)

WAV2LIP_CHECKPOINT_NAME = "wav2lip.pth"
WAV2LIP_DEFAULT_MODEL_DIR = os.path.join(os.path.expanduser("~"), ".videodub", "models")


def run(video_path: str, audio_path: str, job_config: dict, temp_dir: str, progress_fn=None) -> str:
    cfg = job_config['api_providers']['lipsync']
    provider = cfg['provider']

    if provider == "wav2lip":
        return _run_wav2lip(video_path, audio_path, cfg, job_config, temp_dir, progress_fn)
    elif provider == "synclabs":
        return _run_synclabs(video_path, audio_path, cfg, temp_dir, progress_fn)
    else:
        raise ValueError(f"Unknown lip sync provider: {provider}")


# ─── Wav2Lip ───────────────────────────────────────────────────────────────

def _run_wav2lip(video_path: str, audio_path: str, cfg: dict, job_config: dict, temp_dir: str, progress_fn) -> str:
    import subprocess
    import sys

    model_dir = os.environ.get("VIDEODUB_MODEL_DIR", WAV2LIP_DEFAULT_MODEL_DIR)
    checkpoint = os.path.join(model_dir, WAV2LIP_CHECKPOINT_NAME)

    if not os.path.exists(checkpoint):
        raise FileNotFoundError(
            f"Wav2Lip model not found at {checkpoint}. "
            "Please download it from Settings or the first-run setup dialog."
        )

    output_path = os.path.join(temp_dir, "lipsync_output.mp4")
    gpu_enabled = job_config.get("gpu_enabled", True)

    if progress_fn:
        progress_fn(10, "Starting Wav2Lip inference...")

    cmd = [
        sys.executable, "-m", "wav2lip_inference",
        "--checkpoint_path", checkpoint,
        "--face", video_path,
        "--audio", audio_path,
        "--outfile", output_path,
    ]
    if not gpu_enabled:
        cmd.append("--nosmooth")

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    if result.returncode != 0:
        raise RuntimeError(f"Wav2Lip failed: {result.stderr}")

    if progress_fn:
        progress_fn(100, "Wav2Lip complete.")

    return output_path


# ─── Sync Labs ─────────────────────────────────────────────────────────────

def _run_synclabs(video_path: str, audio_path: str, cfg: dict, temp_dir: str, progress_fn) -> str:
    api_key = cfg['api_key']
    api_path = cfg['api_path'] or "https://api.sync.so/v2/generate"
    model = cfg['model'] or "lipsync-2"

    if not api_key:
        raise ValueError("Sync Labs API key is missing.")

    headers = {"x-api-key": api_key, "Content-Type": "application/json"}

    if progress_fn:
        progress_fn(5, "Submitting job to Sync Labs...")

    # NOTE: Sync Labs requires publicly accessible URLs.
    # In production, upload video/audio to a CDN and pass the URLs here.
    payload = {
        "model": model,
        "input": [
            {"type": "video", "url": f"file://{video_path}"},
            {"type": "audio", "url": f"file://{audio_path}"},
        ],
    }

    resp = requests.post(api_path, json=payload, headers=headers, timeout=60)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Sync Labs submit error {resp.status_code}: {resp.text[:200]}")

    job_id = resp.json().get("id")
    if not job_id:
        raise RuntimeError("Sync Labs did not return a job ID.")

    log.info(f"Sync Labs job submitted: {job_id}")

    # Poll for completion
    poll_base = api_path.rstrip("/")
    poll_url = f"{poll_base}/{job_id}"
    timeout = 600
    interval = 5
    elapsed = 0

    while elapsed < timeout:
        time.sleep(interval)
        elapsed += interval

        status_resp = requests.get(poll_url, headers=headers, timeout=30)
        data = status_resp.json()
        status = data.get("status", "")

        pct = min(90, int((elapsed / timeout) * 90))
        if progress_fn:
            progress_fn(pct, f"Sync Labs: {status} ({elapsed}s elapsed)")

        if status == "completed":
            output_url = data.get("outputUrl") or data.get("output_url")
            if not output_url:
                raise RuntimeError("Sync Labs job completed but no output URL.")
            output_path = os.path.join(temp_dir, "lipsync_output.mp4")
            _download_file(output_url, output_path)
            if progress_fn:
                progress_fn(100, "Sync Labs lip sync complete.")
            return output_path

        if status in ("failed", "error"):
            raise RuntimeError(f"Sync Labs job failed: {data.get('error', 'unknown error')}")

    raise TimeoutError(f"Sync Labs job timed out after {timeout}s. Job ID: {job_id}")


def _download_file(url: str, dest: str):
    resp = requests.get(url, stream=True, timeout=120)
    resp.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
