"""
Step 4 — Translation.
Sends transcript segments to LLM for translation.
Preserves segment count and timing boundaries.
"""

import json
import logging
from openai import OpenAI

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a professional video dubbing translator. You will receive a list of timed \
transcript segments in {source_lang}. Translate each segment into {target_lang}.

Rules:
1. Preserve the exact same number of segments.
2. Keep translations concise — they must fit within the original segment duration when spoken aloud.
3. Maintain the speaker's tone and register.
4. Return ONLY a JSON array of objects with no preamble, no markdown, no explanation:

[
  {{"index": 0, "text": "translated text"}},
  {{"index": 1, "text": "..."}}
]"""


def run(transcript: list, job_config: dict, service_cfg: dict, progress_fn=None) -> list:
    cfg = service_cfg["translation"]
    api_key = service_cfg["api_keys"]["openrouter"]
    source_lang = job_config.get("source_lang", "?")
    target_lang = job_config.get("target_lang", "en")

    client = OpenAI(api_key=api_key, base_url=cfg["base_url"])

    segments_payload = [{"index": s["index"], "text": s["text"]} for s in transcript]
    system = SYSTEM_PROMPT.format(source_lang=source_lang, target_lang=target_lang)

    log.info(f"Translating {len(transcript)} segments using {cfg['model']}")
    if progress_fn:
        progress_fn(10, f"Sending {len(transcript)} segments to LLM...")

    response = client.chat.completions.create(
        model=cfg["model"],
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(segments_payload, ensure_ascii=False)},
        ],
        temperature=0.3,
    )

    raw = response.choices[0].message.content.strip()

    if progress_fn:
        progress_fn(80, "Parsing translation response...")

    translated = _parse_translation(raw, transcript)
    log.info(f"Translation complete: {len(translated)} segments")
    return translated


def _parse_translation(raw: str, original: list) -> list:
    """Parse LLM response and merge translated text back with timing data."""
    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]

    try:
        items = json.loads(raw.strip())
    except json.JSONDecodeError as e:
        log.warning(f"Translation JSON parse error: {e}. Using original text.")
        return original

    if len(items) != len(original):
        log.warning(f"Segment count mismatch: got {len(items)}, expected {len(original)}. Attempting best-effort merge.")

    translated = []
    orig_by_index = {s["index"]: s for s in original}

    for item in items:
        idx = item.get("index", 0)
        orig = orig_by_index.get(idx, original[min(idx, len(original) - 1)])
        translated.append({
            **orig,
            "translated_text": item.get("text", orig.get("text", "")),
        })

    return translated
