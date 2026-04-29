"""
Step 1 — Download / Load video.
Handles YouTube URLs (via yt-dlp) and local file copies.
"""

import os
import sys
import shutil
import logging
import subprocess
import imageio_ffmpeg

log = logging.getLogger(__name__)

FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()

SUPPORTED_EXTENSIONS = {".mp4", ".mkv", ".mov", ".avi", ".webm"}


def run(job_config: dict, temp_dir: str, progress_fn=None) -> str:

    youtube_url = job_config.get("youtube_url")
    video_path = job_config.get("video_path")

    if youtube_url:
        return _download_youtube(youtube_url, temp_dir)
    elif video_path:
        return _load_local(video_path, temp_dir)
    else:
        raise ValueError("No video_path or youtube_url provided.")


def _download_youtube(url: str, temp_dir: str) -> str:
    output_template = os.path.join(temp_dir, "input.%(ext)s")
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "--ffmpeg-location", FFMPEG_EXE,
        "-o", output_template,
        "--no-playlist",
        url,
    ]
    log.info(f"Downloading: {url}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)

    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {result.stderr}")

    output_path = os.path.join(temp_dir, "input.mp4")
    if not os.path.exists(output_path):
        # Find whatever yt-dlp actually produced
        for f in os.listdir(temp_dir):
            if f.startswith("input."):
                output_path = os.path.join(temp_dir, f)
                break

    if not os.path.exists(output_path):
        raise RuntimeError("yt-dlp completed but output file not found.")

    log.info(f"Downloaded to: {output_path}")
    return output_path


def _load_local(video_path: str, temp_dir: str) -> str:
    ext = os.path.splitext(video_path)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported format '{ext}'. Use: {', '.join(SUPPORTED_EXTENSIONS)}")

    dest = os.path.join(temp_dir, f"input{ext}")
    shutil.copy2(video_path, dest)
    log.info(f"Copied local file to: {dest}")
    return dest
