#!/usr/bin/env python3
"""
Video Dubbing Sidecar — Entry Point
JSON-RPC dispatcher over stdin/stdout.
"""

import sys
import json
import logging
from pipeline import run_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stderr,  # Keep stderr for internal logs; stdout is for JSON-RPC
)
log = logging.getLogger(__name__)


def emit(event: dict):
    """Write a JSON event to stdout (frontend reads this)."""
    print(json.dumps(event), flush=True)


def dispatch(request: dict):
    """Route incoming commands."""
    cmd = request.get("cmd")
    job_id = request.get("id", "unknown")
    params = request.get("params", {})

    if cmd == "start_job":
        try:
            result = run_pipeline({"id": job_id, **params}, emit_fn=emit)
            emit({
                "id": job_id,
                "event": "done",
                "output_path": result["output_path"],
                "cost_usd": result["cost_usd"],
                "duration_sec": result["duration_sec"],
            })
        except Exception as e:
            log.exception("Pipeline error")
            emit({
                "id": job_id,
                "event": "error",
                "message": str(e),
                "code": type(e).__name__,
            })
    else:
        emit({"id": job_id, "event": "error", "message": f"Unknown command: {cmd}", "code": "ERR_UNKNOWN_CMD"})


def main():
    log.info("Sidecar started — waiting for JSON-RPC commands on stdin")
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            log.error(f"Invalid JSON from frontend: {e}")
            continue
        dispatch(request)


if __name__ == "__main__":
    # CLI test mode:  python main.py --test --video input.mp4 --src hi --tgt en --mode budget
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true")
    parser.add_argument("--video", default=None)
    parser.add_argument("--youtube", default=None)
    parser.add_argument("--src", default="hi")
    parser.add_argument("--tgt", default="en")
    parser.add_argument("--mode", default="budget", choices=["budget", "premium"])
    parser.add_argument("--lip-sync", action="store_true")
    args = parser.parse_args()

    if args.test:
        import os
        test_request = {
            "id": "test_001",
            "cmd": "start_job",
            "params": {
                "video_path": args.video,
                "youtube_url": args.youtube,
                "source_lang": args.src,
                "target_lang": args.tgt,
                "mode": args.mode,
                "lip_sync_enabled": args.lip_sync,
                "lip_sync_engine": "wav2lip",
                "api_keys": {
                    "openrouter": os.environ.get("OPENROUTER_API_KEY", ""),
                    "kie_ai": os.environ.get("KIE_AI_API_KEY", ""),
                    "elevenlabs": os.environ.get("ELEVENLABS_API_KEY"),
                    "sync_labs": os.environ.get("SYNC_LABS_API_KEY"),
                },
            },
        }
        dispatch(test_request)
    else:
        main()
