# AI Video Dubbing

> Cross-platform desktop app (macOS + Windows) that automatically dubs any video into a different language using AI — fully automated pipeline from transcription to final MP4.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri v2 (Rust) |
| UI | React 18 + TypeScript |
| State | Zustand v4 |
| Backend | Python 3.11 sidecar (JSON-RPC over stdio) |
| Video/Audio | FFmpeg 6 |
| YouTube DL | yt-dlp |

## AI Pipeline

```
1. Download / Load  →  2. Extract Audio  →  3. Transcribe (Whisper)
→  4. Translate (LLM)  →  5. TTS  →  6. Align Timing
→  [7. Lip Sync — optional]  →  8. Compose Final MP4
```

## Modes

| | Budget | Premium |
|--|--------|---------|
| Transcription | Whisper via OpenRouter | Whisper via OpenRouter |
| Translation | Gemini 2.0 Flash | GPT-4o |
| TTS | KIE AI | ElevenLabs Multilingual v2 |
| Lip Sync | Wav2Lip (local, free) | Sync Labs API |
| Cost / 5-min video | ~$0.01–$0.05 | ~$0.50–$2.00 |

## Project Structure

```
├── src/                    # React/TypeScript frontend
│   ├── components/         # Reusable UI components
│   ├── screens/            # Main app screens
│   ├── store/              # Zustand state stores
│   ├── lib/                # Utilities (cost, languages, sidecar IPC)
│   ├── tauri-commands/     # Native OS dialog wrappers
│   └── styles/             # CSS design system
├── sidecar/                # Python AI processing sidecar
│   ├── steps/              # Individual pipeline steps
│   ├── main.py             # JSON-RPC dispatcher
│   ├── pipeline.py         # Orchestrator
│   ├── config.py           # Budget/Premium configs
│   └── requirements.txt
└── src-tauri/              # Tauri (Rust) shell config
```

## Development

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js 18+](https://nodejs.org)
- [Python 3.11+](https://python.org)
- FFmpeg in PATH

### Setup

```bash
# Install Node dependencies
npm install

# Install Python dependencies
pip install -r sidecar/requirements.txt

# Run in development mode
npm run tauri dev
```

### Test the Python sidecar (CLI)

```bash
export OPENROUTER_API_KEY=sk-or-...
export KIE_AI_API_KEY=...

python sidecar/main.py --test \
  --video input.mp4 \
  --src hi --tgt en \
  --mode budget
```

### Build installer

```bash
npm run tauri build
```

## Branches

| Branch | Purpose |
|--------|---------|
| `production` | Stable releases only |
| `dev` | Active development |

## API Keys Required

| Key | Where to get |
|-----|-------------|
| OpenRouter | https://openrouter.ai/keys |
| KIE AI (Budget TTS) | https://kie.ai/dashboard |
| ElevenLabs (Premium TTS) | https://elevenlabs.io/api |
| Sync Labs (Premium Lip Sync) | https://sync.so/dashboard |

## Development Phases

- [x] **Phase 1** — Python sidecar core pipeline
- [ ] **Phase 2** — Tauri UI (Home + Progress + Results + Settings)
- [ ] **Phase 3** — Mode toggle + cost estimation
- [ ] **Phase 4** — Lip sync integration
- [ ] **Phase 5** — Packaging (DMG + NSIS installer)
- [ ] **Phase 6** — Polish, error handling, GPU detection
