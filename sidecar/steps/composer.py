"""
Step 8 — Final Compose.
Replaces original audio with dubbed audio using FFmpeg.
Outputs final MP4.
"""

import os
import logging
import ffmpeg

log = logging.getLogger(__name__)


def run(video_path: str, dubbed_audio: str, job_config: dict, temp_dir: str) -> str:
    target_lang = job_config.get("target_lang", "en")
    job_id = job_config.get("id", "output")
    output_path = os.path.join(temp_dir, f"{job_id}_dubbed_{target_lang}.mp4")

    log.info(f"Composing final video: {output_path}")

    try:
        video_in = ffmpeg.input(video_path)
        audio_in = ffmpeg.input(dubbed_audio)

        (
            ffmpeg
            .output(
                video_in.video,
                audio_in.audio,
                output_path,
                vcodec="copy",           # Keep original video codec — fast, no re-encode
                acodec="aac",
                audio_bitrate="192k",
                shortest=None,           # Trim to shortest stream
            )
            .overwrite_output()
            .run(quiet=True)
        )
    except ffmpeg.Error as e:
        raise RuntimeError(f"Final compose failed: {e.stderr.decode()}")

    if not os.path.exists(output_path):
        raise RuntimeError("Compose step produced no output file.")

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    log.info(f"Final video ready: {output_path} ({size_mb:.1f} MB)")
    return output_path
