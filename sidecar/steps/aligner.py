"""
Step 6 — Audio Timing Alignment.
Uses FFmpeg atempo filter to stretch/compress each TTS clip to fit its original timeslot.
Concatenates all aligned clips into one full dubbed audio track.
"""

import os
import logging
import subprocess
import re
import ffmpeg
import imageio_ffmpeg

log = logging.getLogger(__name__)

FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()


def run(tts_segments: list, transcript: list, temp_dir: str, progress_fn=None) -> str:
    aligned_paths = []
    total = len(tts_segments)

    for i, seg in enumerate(tts_segments):
        tts_path = seg.get("tts_path")
        original_duration = seg.get("duration", 0)

        if not tts_path or not os.path.exists(tts_path):
            log.warning(f"Segment {i} missing TTS file, skipping.")
            continue

        aligned_path = os.path.join(temp_dir, f"aligned_{i:04d}.wav")
        _align_segment(tts_path, aligned_path, original_duration, i)
        aligned_paths.append(aligned_path)

        if progress_fn:
            pct = int(((i + 1) / total) * 90)
            progress_fn(pct, f"Aligning segment {i + 1}/{total}")

    if not aligned_paths:
        raise RuntimeError("No aligned audio segments produced.")

    dubbed_path = os.path.join(temp_dir, "dubbed_full.wav")
    _concatenate(aligned_paths, dubbed_path, temp_dir)

    if progress_fn:
        progress_fn(100, "Audio alignment complete.")

    log.info(f"Full dubbed audio: {dubbed_path}")
    return dubbed_path


def _get_duration(path: str) -> float:
    try:
        res = subprocess.run([FFMPEG_EXE, "-i", path], capture_output=True, text=True, encoding='utf-8', errors='ignore')
        match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", res.stderr)
        if match:
            h, m, s = match.groups()
            return float(h)*3600 + float(m)*60 + float(s)
    except Exception as e:
        log.warning(f"Failed to get duration for {path}: {e}")
    return 0.0


def _align_segment(tts_path: str, out_path: str, original_duration: float, index: int):
    """Apply atempo filter to make TTS fit within original_duration."""
    tts_duration = _get_duration(tts_path)
    if tts_duration <= 0:
        log.warning(f"Segment {index}: could not probe TTS file. Copying as-is.")
        import shutil
        shutil.copy2(tts_path, out_path)
        return

    if original_duration <= 0:
        import shutil
        shutil.copy2(tts_path, out_path)
        return

    ratio = tts_duration / original_duration

    try:
        if ratio < 0.5:
            # TTS much longer than original — truncate
            log.warning(f"Segment {index}: truncated (ratio={ratio:.2f})")
            (
                ffmpeg.input(tts_path)
                .output(out_path, t=original_duration, acodec="pcm_s16le", ar=16000, ac=1)
                .overwrite_output()
                .run(cmd=FFMPEG_EXE, quiet=True)
            )
        elif 0.5 <= ratio <= 2.0:
            # Single atempo
            (
                ffmpeg.input(tts_path)
                .filter("atempo", ratio)
                .output(out_path, acodec="pcm_s16le", ar=16000, ac=1)
                .overwrite_output()
                .run(cmd=FFMPEG_EXE, quiet=True)
            )
        else:
            # ratio > 2.0: chain two atempo filters
            r1, r2 = 2.0, ratio / 2.0
            (
                ffmpeg.input(tts_path)
                .filter("atempo", r1)
                .filter("atempo", r2)
                .output(out_path, acodec="pcm_s16le", ar=16000, ac=1)
                .overwrite_output()
                .run(cmd=FFMPEG_EXE, quiet=True)
            )
    except ffmpeg.Error as e:
        log.error(f"Segment {index} atempo failed: {e.stderr.decode()}")
        import shutil
        shutil.copy2(tts_path, out_path)


def _concatenate(paths: list, out_path: str, temp_dir: str):
    """Concatenate aligned WAV segments into one file using FFmpeg concat demuxer."""
    list_file = os.path.join(temp_dir, "concat_list.txt")
    with open(list_file, "w", encoding="utf-8") as f:
        for p in paths:
            f.write(f"file '{p.replace(chr(39), '')}'\n")

    try:
        (
            ffmpeg
            .input(list_file, format="concat", safe=0)
            .output(out_path, acodec="pcm_s16le", ar=16000, ac=1)
            .overwrite_output()
            .run(cmd=FFMPEG_EXE, quiet=True)
        )
    except ffmpeg.Error as e:
        raise RuntimeError(f"Audio concatenation failed: {e.stderr.decode()}")
