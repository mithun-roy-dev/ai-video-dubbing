"""
Step 2 — Audio Extraction.
Uses ffmpeg-python to extract mono 16kHz WAV (optimal for Whisper).
"""

import os
import logging
import ffmpeg

log = logging.getLogger(__name__)


def run(video_path: str, temp_dir: str) -> str:
    audio_path = os.path.join(temp_dir, "audio.wav")
    log.info(f"Extracting audio from: {video_path}")

    try:
        (
            ffmpeg
            .input(video_path)
            .output(
                audio_path,
                vn=None,           # No video stream
                acodec="pcm_s16le",
                ar=16000,          # 16kHz — optimal for Whisper
                ac=1,              # Mono
            )
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as e:
        raise RuntimeError(f"FFmpeg audio extraction failed: {e.stderr.decode()}")

    if not os.path.exists(audio_path):
        raise RuntimeError("Audio extraction produced no output file.")

    size_mb = os.path.getsize(audio_path) / 1024 / 1024
    log.info(f"Audio extracted: {audio_path} ({size_mb:.1f} MB)")
    return audio_path
