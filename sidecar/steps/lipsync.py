"""
Step 7 — Lip Sync (Optional).
Budget: Wav2Lip local Python inference
Premium: Sync Labs API (async polling)
"""

import os
import time
import logging
import requests

log = logging.getLogger(__name__)

WAV2LIP_MODEL_PATH_ENV = "VIDEODUB_MODEL_DIR"
WAV2LIP_CHECKPOINT = "wav2lip.pth"


def run(video_path: str, audio_path: str, job_config: dict, service_cfg: dict, temp_dir: str, progress_fn=None) -> str:
    provider = service_cfg["lipsync"]["provider"]

    if provider == "wav2lip":
        return _run_wav2lip(video_path, audio_path, job_config, service_cfg, temp_dir, progress_fn)
    elif provider == "synclabs":
        return _run_synclabs(video_path, audio_path, job_config, service_cfg, temp_dir, progress_fn)
    else:
        raise ValueError(f"Unknown lip sync provider: {provider}")


# ─── Wav2Lip ───────────────────────────────────────────────────────────────

def _run_wav2lip(video_path: str, audio_path: str, job_config: dict, service_cfg: dict, temp_dir: str, progress_fn) -> str:
    import subprocess
    import sys

    model_dir = os.environ.get(WAV2LIP_MODEL_PATH_ENV, os.path.join(os.path.expanduser("~"), ".videodub", "models"))
    checkpoint = os.path.join(model_dir, WAV2LIP_CHECKPOINT)

    if not os.path.exists(checkpoint):
        raise FileNotFoundError(
            f"Wav2Lip model not found at {checkpoint}. "
            "Please download it from the app settings or first-run dialog."
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

def _run_synclabs(video_path: str, audio_path: str, job_config: dict, service_cfg: dict, temp_dir: str, progress_fn) -> str:
    cfg = service_cfg["lipsync"]
    api_key = service_cfg["api_keys"]["sync_labs"]

    if not api_key:
        raise ValueError("Sync Labs API key is missing.")

    # Sync Labs requires publicly accessible URLs — upload files first
    # In production, upload to a signed URL or temp storage; here we use direct file POST
    headers = {"x-api-key": api_key, "Content-Type": "application/json"}

    if progress_fn:
        progress_fn(5, "Submitting job to Sync Labs...")

    # For the API to work, video/audio must be accessible URLs.
    # This placeholder shows the structure — actual upload step needed in production.
    payload = {
        "model": cfg.get("model", "lipsync-2"),
        "input": [
            {"type": "video", "url": f"file://{video_path}"},
            {"type": "audio", "url": f"file://{audio_path}"},
        ],
    }

    resp = requests.post(cfg["api_url"], json=payload, headers=headers, timeout=60)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Sync Labs submit error {resp.status_code}: {resp.text[:200]}")

    job_id = resp.json().get("id")
    if not job_id:
        raise RuntimeError("Sync Labs did not return a job ID.")

    log.info(f"Sync Labs job submitted: {job_id}")

    # Poll for completion
    poll_url = f"{cfg['api_url']}/{job_id}"
    timeout = cfg.get("timeout_sec", 600)
    interval = cfg.get("poll_interval_sec", 5)
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
