"""
Step 2 — Audio Extraction.
Uses ffmpeg-python with the imageio-ffmpeg bundled binary to extract mono 16kHz WAV (optimal for Whisper).
"""

import os
import logging
import ffmpeg
import imageio_ffmpeg

log = logging.getLogger(__name__)

# Use the bundled ffmpeg binary from imageio-ffmpeg (no system ffmpeg needed)
FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()


def run(video_path: str, temp_dir: str) -> str:
    audio_path = os.path.join(temp_dir, "audio.wav")
    log.info(f"Extracting audio from: {video_path} using {FFMPEG_EXE}")

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
            .run(cmd=FFMPEG_EXE, quiet=True)
        )
    except ffmpeg.Error as e:
        stderr = e.stderr.decode() if e.stderr else str(e)
        raise RuntimeError(f"FFmpeg audio extraction failed: {stderr}")

    if not os.path.exists(audio_path):
        raise RuntimeError("Audio extraction produced no output file.")

    size_mb = os.path.getsize(audio_path) / 1024 / 1024
    log.info(f"Audio extracted: {audio_path} ({size_mb:.1f} MB)")
    return audio_path
