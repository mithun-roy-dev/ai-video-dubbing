# Video Dubbing Desktop App — Complete Technical Specification

> **For:** Google Gemini / Any AI Developer  
> **Version:** 1.0 — April 2026  
> **Platform:** macOS + Windows Desktop App

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Application Architecture](#2-application-architecture)
3. [Budget Mode vs Premium Mode](#3-budget-mode-vs-premium-mode)
4. [Lip Sync Feature (Toggleable)](#4-lip-sync-feature-toggleable)
5. [UI Screens & Components](#5-ui-screens--components)
6. [Python Sidecar — Full Specification](#6-python-sidecar--full-specification)
7. [Frontend — React/Tauri Structure](#7-frontend--reacttauri-structure)
8. [Cost Estimation Logic](#8-cost-estimation-logic)
9. [Packaging & Distribution](#9-packaging--distribution)
10. [Error Handling & Edge Cases](#10-error-handling--edge-cases)
11. [Recommended Development Phases](#11-recommended-development-phases)
12. [Key Notes for the AI Developer](#12-key-notes-for-the-ai-developer)

---

## 1. Project Overview

Build a cross-platform desktop application (macOS + Windows) that allows users to upload any video — especially YouTube videos — and automatically dub (re-voice) the audio into a different language using AI services. The final output is a downloadable MP4 video in the target language.

### 1.1 Product Goals

- Accept a video file or YouTube URL as input
- Let the user specify the source language (e.g. Hindi) and the target language (e.g. English)
- Run a fully automated AI pipeline: **Extract → Transcribe → Translate → Text-to-Speech → Compose**
- Support optional lip-sync processing (toggle on/off in Settings)
- Support two modes switchable at runtime: **Budget (low-cost)** and **Premium (high-quality)**
- Output a clean MP4 dubbed video file

### 1.2 Target Platform

| Platform | Target | Notes |
|----------|--------|-------|
| macOS | 10.15+ (Catalina and above) | ARM (M1/M2/M3) + Intel supported |
| Windows | Windows 10 / 11 (64-bit) | x64 only |
| Linux | Not required (v1.0) | Optional future support |

---

## 2. Application Architecture

### 2.1 Technology Stack Overview

The application uses a **two-layer architecture**:

- **Frontend Layer:** Tauri (Rust shell) + React (TypeScript) for the desktop UI
- **Backend Layer:** A bundled Python sidecar process that handles all AI API calls, FFmpeg operations, and file processing

> **Why Tauri + Python Sidecar?**  
> Tauri produces a very small installer (~5–15 MB vs. Electron's ~150 MB). The Python sidecar lets us use the rich AI/ML ecosystem (Whisper, Wav2Lip, yt-dlp) without rewriting everything in Rust. The two processes communicate via stdin/stdout JSON-RPC.

### 2.2 Full Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Desktop Shell | Tauri | v2.x | Native window, installer, OS integration |
| UI Framework | React + TypeScript | React 18 | All screens and components |
| UI Styling | TailwindCSS | v3.x | Styling system |
| State Management | Zustand | v4.x | Global app state |
| Backend Sidecar | Python | 3.11+ | All AI and file processing |
| Video/Audio | FFmpeg | 6.x | Extract, merge, transcode |
| YouTube Download | yt-dlp | Latest | Download YouTube videos |
| IPC | JSON-RPC over stdio | Custom | Frontend ↔ Python communication |
| Packaging | Tauri bundler | v2.x | DMG (Mac), NSIS installer (Win) |

### 2.3 Processing Pipeline (Step by Step)

Every job runs through these sequential steps. Each step emits progress events back to the UI.

```
STEP 1 — Input Acquisition
  └─ YouTube URL → yt-dlp downloads best-quality MP4
  └─ Local file  → copied to working temp directory

STEP 2 — Audio Extraction
  └─ FFmpeg strips audio track from video
  └─ Output: mono WAV at 16kHz (optimal for Whisper)

STEP 3 — Transcription
  └─ WAV file sent to Whisper model
  └─ Output: JSON with full transcript + word-level timestamps

STEP 4 — Translation
  └─ Transcript segments sent to LLM
  └─ Prompt preserves segment count and timing boundaries
  └─ Output: translated segments with matching timing data

STEP 5 — Text-to-Speech
  └─ Each translated segment sent to TTS service
  └─ Output: individual audio clips per segment

STEP 6 — Audio Timing Alignment
  └─ FFmpeg atempo filter stretches/compresses each TTS clip
     to fit within its original segment duration
  └─ All clips concatenated into one full dubbed audio track

STEP 7 — Lip Sync  [OPTIONAL — skipped if disabled in Settings]
  └─ Dubbed audio + original video frames → lip-sync engine
  └─ Animates mouth movements to match new audio

STEP 8 — Final Compose
  └─ FFmpeg replaces original audio with dubbed audio
  └─ Encodes final MP4 output file
```

---

## 3. Budget Mode vs Premium Mode

### 3.1 Overview

The user can toggle between **Budget** and **Premium** mode from the main UI header at any time. The selected mode persists to app settings. Each mode uses different AI services for the three AI steps: Transcription, Translation, and TTS.

### 3.2 Comparison Table

| Pipeline Step | Budget Mode | Premium Mode |
|--------------|-------------|--------------|
| Transcription | Whisper large-v3 via OpenRouter API | OpenAI Whisper API (official endpoint) |
| Translation LLM | Google Gemini 2.0 Flash via OpenRouter | GPT-4o or Claude 3.5 Sonnet via OpenRouter |
| Text-to-Speech | KIE AI TTS API | ElevenLabs API (with voice cloning) |
| Lip Sync (optional) | Wav2Lip — local Python (free, GPU helpful) | Sync Labs API (cloud, HD quality) |
| Est. cost / 5-min video | ~$0.01 – $0.05 | ~$0.50 – $2.00 |
| Quality | Good — suitable for most use cases | Excellent — near-broadcast quality |
| Speed | Fast (all cloud APIs) | Fast (all cloud APIs, Sync Labs async) |

### 3.3 Mode Toggle Behavior

The mode toggle is a **prominent switch in the app header** labeled `Budget` / `Premium`. When toggled:

- The pipeline config object switches to the corresponding service set
- The Settings panel shows/hides relevant API key fields for the active mode
- Any in-progress job is **NOT interrupted** — the new mode applies to the next job
- A small cost estimate badge updates in the UI based on the selected mode and input video length

> **UI Design:** Use a pill-style toggle with color coding — **teal = Budget**, **purple = Premium**. Show an estimated cost range in small text beneath the toggle.

---

## 4. Lip Sync Feature (Toggleable)

### 4.1 Overview

Lip sync is an **optional step** in the pipeline that animates the speaker's mouth movements in the video to match the new dubbed audio. It significantly increases processing time and cost in Premium mode.

### 4.2 Lip Sync Toggle — Location & Behavior

- **Location:** Settings screen → Section "Pipeline Options"
- **Label:** `Enable Lip Sync Processing`
- **Sub-label:** `Animates speaker mouth movements to match dubbed audio. Increases processing time.`
- **Default state:** OFF (disabled)
- **Persistence:** Toggle state saved to `settings.json`

### 4.3 Pipeline Logic

```python
if job_config['lip_sync_enabled']:
    run_lip_sync(video_path, dubbed_audio_path)
else:
    skip_to_compose(video_path, dubbed_audio_path)
```

| State | Budget Mode | Premium Mode |
|-------|-------------|--------------|
| **Lip Sync OFF** | Skip step → go straight to FFmpeg compose | Skip step → go straight to FFmpeg compose |
| **Lip Sync ON** | Run **Wav2Lip** locally (free, Python/PyTorch) | Call **Sync Labs API** (cloud, HD quality) |

### 4.4 Wav2Lip Setup (Budget Lip Sync)

On first launch with lip sync enabled in Budget mode, the app must:

1. Check if model weights exist at: `{app_data}/models/wav2lip.pth`
2. If not present, show a one-time download dialog: *"Downloading lip sync model (400 MB)..."*
3. Download from the Wav2Lip GitHub releases (or a hosted mirror)
4. Verify SHA256 checksum after download
5. Store in the app data directory

### 4.5 Sync Labs Integration (Premium Lip Sync)

```
POST  https://api.sync.so/v2/generate
      Body: { video_url, audio_url, model: "lipsync-2" }

GET   https://api.sync.so/v2/generate/{job_id}
      Poll every 5 seconds until status == "completed"
      Timeout after 10 minutes
      Download result MP4 on completion
```

---

## 5. UI Screens & Components

### 5.1 Main Screen (Home)

#### Header Bar
- App name/logo — left side
- **Budget / Premium mode toggle** — center (pill-style, teal = Budget, purple = Premium)
- Settings icon button — right side

#### Input Panel
- Large drag-and-drop zone: *"Drop video here or click to upload"*
- `Or paste YouTube URL` text input below the drop zone
- Supported formats badge: `MP4  MKV  MOV  AVI  WebM`

#### Language Selection Panel
- **Source Language** dropdown — searchable list of all languages (ISO 639-1)
- Arrow icon `→` between the two dropdowns
- **Target Language** dropdown — same searchable list
- Quick-select common pairs: `Hindi→English`, `Spanish→English`, `Arabic→English`, `French→English`

#### Action Bar
- Large primary button: **`Start Dubbing`**
- Estimated cost display: *"Est. cost: ~$0.02"* (updates on language/mode/duration change)
- Estimated time display: *"Est. time: ~3 min"*

---

### 5.2 Progress Screen

Shown after the user clicks Start Dubbing. Displays real-time progress:

- **Current step indicator** — numbered list with active step highlighted + spinner
- **Step list:**
  ```
  ✓ 1. Download / Load video
  ✓ 2. Extract audio
  ⟳ 3. Transcribe  ← active
    4. Translate
    5. Text-to-Speech
    6. Align timing
    7. Lip Sync  [shown only if enabled]
    8. Compose final video
  ```
- **Live log** (collapsible textarea) — streams stdout from the Python sidecar
- **Cancel button** — gracefully kills the sidecar subprocess and cleans up temp files

---

### 5.3 Results Screen

Shown when the pipeline completes successfully:

- Video preview player (native HTML5 video element via Tauri's webview)
- **`Save Video`** button → opens native OS file-save dialog, default filename: `{original}_dubbed_{target_lang}.mp4`
- **`Open in Finder / Explorer`** button
- **`Dub Another Video`** button → returns to Main Screen
- Summary card:

  | Field | Value |
  |-------|-------|
  | Source language | Hindi |
  | Target language | English |
  | Duration | 5:12 |
  | Mode used | Budget |
  | Total API cost | ~$0.03 |

---

### 5.4 Settings Screen

Accessible via the gear icon. Contains two sections:

#### Section A: API Keys

| Key Name | Mode | Required? | Where to Get |
|----------|------|-----------|--------------|
| OpenRouter API Key | Both | Yes | openrouter.ai/keys |
| KIE AI API Key | Budget TTS | Yes (Budget) | kie.ai dashboard |
| ElevenLabs API Key | Premium TTS | Yes (Premium) | elevenlabs.io/api |
| Sync Labs API Key | Premium Lip Sync | Only if lip sync ON + Premium | sync.so/dashboard |
| OpenAI API Key | Premium (optional) | No — uses OpenRouter | platform.openai.com |

#### Section B: Pipeline Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Enable Lip Sync Processing | Toggle | OFF | Run lip sync step in pipeline |
| Lip sync engine | Selector | Wav2Lip | `Wav2Lip (local, free)` or `Sync Labs API (cloud)` |
| Output directory | Folder picker | ~/Downloads | Where to save dubbed videos |
| Keep temp files | Checkbox | OFF | Useful for debugging |
| GPU acceleration | Toggle | Auto | Enable CUDA for Wav2Lip (greyed out if no GPU found) |

---

## 6. Python Sidecar — Full Specification

### 6.1 File Structure

```
sidecar/
├── main.py              # Entry point, JSON-RPC dispatcher
├── pipeline.py          # Orchestrates all steps
├── steps/
│   ├── downloader.py    # yt-dlp wrapper
│   ├── extractor.py     # FFmpeg audio extraction
│   ├── transcriber.py   # Whisper API calls
│   ├── translator.py    # LLM translation
│   ├── tts.py           # KIE AI / ElevenLabs TTS
│   ├── aligner.py       # FFmpeg atempo timing alignment
│   ├── lipsync.py       # Wav2Lip / Sync Labs (conditional)
│   └── composer.py      # Final FFmpeg merge
├── config.py            # Mode configs (Budget / Premium)
├── utils.py             # Shared helpers (logging, temp dirs)
└── requirements.txt     # Python dependencies
```

### 6.2 JSON-RPC Protocol (Frontend ↔ Sidecar)

**Frontend → Sidecar (stdin, newline-delimited JSON):**

```json
{
  "id": "job_001",
  "cmd": "start_job",
  "params": {
    "video_path": "/tmp/input.mp4",
    "youtube_url": null,
    "source_lang": "hi",
    "target_lang": "en",
    "mode": "budget",
    "lip_sync_enabled": false,
    "lip_sync_engine": "wav2lip",
    "api_keys": {
      "openrouter": "sk-or-...",
      "kie_ai": "...",
      "elevenlabs": null,
      "sync_labs": null
    }
  }
}
```

**Sidecar → Frontend (stdout, newline-delimited JSON):**

```json
// Progress event
{ "id": "job_001", "event": "progress", "step": 3, "step_name": "Transcribing", "pct": 45, "message": "Transcribing audio segment 3/7..." }

// Completion event
{ "id": "job_001", "event": "done", "output_path": "/tmp/job_001/output_dubbed_en.mp4", "cost_usd": 0.023, "duration_sec": 312 }

// Error event
{ "id": "job_001", "event": "error", "step": 3, "message": "Whisper API timeout after 30s", "code": "ERR_TIMEOUT" }
```

### 6.3 Budget Mode — Service Config

| Step | Service | Endpoint | Model / Config |
|------|---------|----------|----------------|
| Transcription | OpenRouter | `https://openrouter.ai/api/v1/audio/transcriptions` | `openai/whisper-large-v3` |
| Translation | OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | `google/gemini-2.0-flash-exp` |
| TTS | KIE AI | Check KIE AI docs for exact endpoint | Default voice for target language |
| Lip Sync | Wav2Lip | Local Python subprocess | `wav2lip.pth` model weights |

### 6.4 Premium Mode — Service Config

| Step | Service | Endpoint | Model / Config |
|------|---------|----------|----------------|
| Transcription | OpenRouter | `https://openrouter.ai/api/v1/audio/transcriptions` | `openai/whisper-large-v3` |
| Translation | OpenRouter | `https://openrouter.ai/api/v1/chat/completions` | `openai/gpt-4o` OR `anthropic/claude-3-5-sonnet` |
| TTS | ElevenLabs | `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` | Multilingual v2 model |
| Lip Sync | Sync Labs | `https://api.sync.so/v2/generate` | `lipsync-2` model |

### 6.5 Translation Prompt Template

Use this exact system prompt for all LLM translation calls:

```
You are a professional video dubbing translator. You will receive a list of timed 
transcript segments in {source_lang}. Translate each segment into {target_lang}.

Rules:
1. Preserve the exact same number of segments.
2. Keep translations concise — they must fit within the original segment duration 
   when spoken aloud.
3. Maintain the speaker's tone and register.
4. Return ONLY a JSON array of objects with no preamble, no markdown, no explanation:

[
  {"index": 0, "text": "translated text"},
  {"index": 1, "text": "..."}
]
```

### 6.6 Audio Timing Alignment Logic

After TTS generation, each audio segment may be longer or shorter than its original timeslot. Use FFmpeg `atempo` to fix this:

```python
ratio = tts_duration / original_duration

if 0.5 <= ratio <= 2.0:
    # Single atempo filter
    ffmpeg -i segment.wav -filter:a "atempo={ratio}" out.wav

elif ratio > 2.0:
    # TTS is much shorter — chain two atempo filters
    ffmpeg -i segment.wav -filter:a "atempo=2.0,atempo={ratio/2}" out.wav

elif ratio < 0.5:
    # TTS is much longer — truncate and log warning
    ffmpeg -i segment.wav -t {original_duration} out.wav
    log.warning(f"Segment {i} truncated — TTS was {ratio:.1f}x longer than original")

# Concatenate all aligned segments
ffmpeg -f concat -safe 0 -i segments.txt -c copy dubbed_full.wav
```

### 6.7 Python Dependencies (requirements.txt)

```
yt-dlp>=2024.1.1
openai>=1.14.0            # Used for Whisper API-compatible calls via OpenRouter
requests>=2.31.0
pydub>=0.25.1             # Audio manipulation
ffmpeg-python>=0.2.0      # FFmpeg Python bindings
torch>=2.1.0              # Required for Wav2Lip (CPU or CUDA)
numpy>=1.24.0
opencv-python>=4.8.0      # Required for Wav2Lip face detection
tqdm>=4.66.0
elevenlabs>=1.0.0         # ElevenLabs Python SDK (Premium TTS)
```

### 6.8 pipeline.py — Core Orchestration Logic

```python
def run_pipeline(job_config: dict) -> dict:
    job_id = job_config["id"]
    mode = job_config["mode"]           # "budget" | "premium"
    lip_sync = job_config["lip_sync_enabled"]  # True | False

    emit_progress(job_id, step=1, name="Download", pct=0)
    video_path = downloader.run(job_config)

    emit_progress(job_id, step=2, name="Extract Audio", pct=0)
    audio_path = extractor.run(video_path)

    emit_progress(job_id, step=3, name="Transcribe", pct=0)
    transcript = transcriber.run(audio_path, job_config)

    emit_progress(job_id, step=4, name="Translate", pct=0)
    translated = translator.run(transcript, job_config)

    emit_progress(job_id, step=5, name="Text-to-Speech", pct=0)
    tts_segments = tts.run(translated, job_config)

    emit_progress(job_id, step=6, name="Align Timing", pct=0)
    dubbed_audio = aligner.run(tts_segments, transcript)

    if lip_sync:
        emit_progress(job_id, step=7, name="Lip Sync", pct=0)
        video_path = lipsync.run(video_path, dubbed_audio, job_config)
    # else: skip Step 7 entirely, proceed to compose

    emit_progress(job_id, step=8, name="Compose", pct=0)
    output_path = composer.run(video_path, dubbed_audio, job_config)

    return {"output_path": output_path, "cost_usd": calculate_cost(job_config)}
```

---

## 7. Frontend — React/Tauri Structure

### 7.1 Directory Layout

```
src/
├── App.tsx
├── main.tsx
├── store/
│   ├── useAppStore.ts        # Zustand: mode, settings, current job
│   └── useJobStore.ts        # Zustand: job progress, logs, result
├── screens/
│   ├── HomeScreen.tsx        # Main input screen
│   ├── ProgressScreen.tsx    # Job running screen
│   ├── ResultScreen.tsx      # Done screen
│   └── SettingsScreen.tsx    # API keys + pipeline options
├── components/
│   ├── ModeToggle.tsx        # Budget/Premium pill toggle
│   ├── DropZone.tsx          # Drag-and-drop video input
│   ├── LanguageSelect.tsx    # Searchable language dropdowns
│   ├── ProgressStepper.tsx   # Step-by-step progress display
│   ├── LogViewer.tsx         # Collapsible live log textarea
│   └── CostBadge.tsx         # Estimated cost display
├── lib/
│   ├── sidecar.ts            # IPC: send commands, receive events
│   ├── cost.ts               # Cost estimation logic
│   └── languages.ts          # ISO 639-1 language list
└── tauri-commands/
    └── fileDialog.ts         # Native file open/save dialogs
```

### 7.2 Zustand Store Shape

```typescript
// useAppStore.ts
interface AppState {
  mode: 'budget' | 'premium'
  settings: {
    openrouterKey: string
    kieAiKey: string
    elevenLabsKey: string
    syncLabsKey: string
    lipSyncEnabled: boolean
    lipSyncEngine: 'wav2lip' | 'synclabs'
    outputDir: string
    keepTempFiles: boolean
    gpuEnabled: boolean
  }
  sourceLang: string   // ISO 639-1 code e.g. "hi"
  targetLang: string   // ISO 639-1 code e.g. "en"
  videoPath: string | null
  youtubeUrl: string
  setMode: (mode: 'budget' | 'premium') => void
  updateSettings: (partial: Partial<AppState['settings']>) => void
}

// useJobStore.ts
interface JobState {
  jobId: string | null
  status: 'idle' | 'running' | 'done' | 'error' | 'cancelled'
  currentStep: number
  currentStepName: string
  pct: number
  logs: string[]
  result: { outputPath: string; costUsd: number; durationSec: number } | null
  error: string | null
}
```

### 7.3 Sidecar IPC (sidecar.ts)

```typescript
import { Command } from '@tauri-apps/api/shell'
import { useJobStore } from '../store/useJobStore'

let sidecarProcess: ReturnType<typeof Command.sidecar> | null = null

export async function startJob(jobConfig: JobConfig) {
  sidecarProcess = Command.sidecar('sidecar/main')

  sidecarProcess.stdout.on('data', (line: string) => {
    try {
      const event = JSON.parse(line.trim())
      const store = useJobStore.getState()

      if (event.event === 'progress') {
        store.updateProgress(event.step, event.step_name, event.pct, event.message)
        store.appendLog(event.message)
      }
      if (event.event === 'done') {
        store.setResult(event)
      }
      if (event.event === 'error') {
        store.setError(event.message)
      }
    } catch (e) {
      // ignore non-JSON lines (e.g. debug prints)
    }
  })

  await sidecarProcess.spawn()
  await sidecarProcess.stdin.write(JSON.stringify(jobConfig) + '\n')
}

export async function cancelJob() {
  if (sidecarProcess) {
    await sidecarProcess.kill()
    sidecarProcess = null
  }
}
```

### 7.4 ModeToggle Component

```tsx
// ModeToggle.tsx
export function ModeToggle() {
  const { mode, setMode } = useAppStore()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setMode('budget')}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
          mode === 'budget'
            ? 'bg-teal-500 text-white shadow'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        Budget
      </button>
      <button
        onClick={() => setMode('premium')}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
          mode === 'premium'
            ? 'bg-purple-600 text-white shadow'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        Premium
      </button>
      <CostBadge />
    </div>
  )
}
```

---

## 8. Cost Estimation Logic

### 8.1 Per-Service Pricing

| Service | Mode | Rate | Unit |
|---------|------|------|------|
| Whisper (OpenRouter) | Both | $0.006 | per audio minute |
| Gemini 2.0 Flash (OpenRouter) | Budget | $0.00015 | per 1K output tokens |
| GPT-4o (OpenRouter) | Premium | $0.015 | per 1K output tokens |
| KIE AI TTS | Budget | Check your plan | kie.ai dashboard |
| ElevenLabs Multilingual v2 | Premium | $0.30 | per 1K characters |
| Wav2Lip | Budget Lip Sync | $0.00 | Free (local compute) |
| Sync Labs lipsync-2 | Premium Lip Sync | ~$0.03 | per video second |

### 8.2 Estimation Function (cost.ts)

```typescript
export function estimateCost(
  durationSec: number,
  mode: 'budget' | 'premium',
  lipSyncEnabled: boolean
): { low: number; high: number } {

  const mins = durationSec / 60
  const tokens = durationSec * 15    // ~15 tokens/sec of speech
  const chars = durationSec * 20     // ~20 chars/sec of speech

  const transcribeCost = mins * 0.006

  const translateCost = mode === 'budget'
    ? (tokens / 1000) * 0.00015
    : (tokens / 1000) * 0.015

  const ttsCost = mode === 'budget'
    ? 0  // KIE AI — use plan pricing, estimate as 0
    : (chars / 1000) * 0.30

  const lipSyncCost = !lipSyncEnabled ? 0
    : mode === 'budget' ? 0          // Wav2Lip is free
    : durationSec * 0.03             // Sync Labs per second

  const total = transcribeCost + translateCost + ttsCost + lipSyncCost

  return {
    low:  parseFloat((total * 0.8).toFixed(3)),
    high: parseFloat((total * 1.2).toFixed(3)),
  }
}
```

---

## 9. Packaging & Distribution

### 9.1 Bundled Dependencies

The following **must be bundled** inside the installer — users should not need to install anything:

| Dependency | Method | Size |
|------------|--------|------|
| FFmpeg binary | Statically compiled, bundled in Tauri `resources/` | ~70 MB |
| yt-dlp binary | Single-file binary, bundled in Tauri `resources/` | ~15 MB |
| Python 3.11 runtime | Embedded via `python-build-standalone` | ~30 MB |
| All pip packages | Pre-installed into bundled Python env | ~200 MB |
| Wav2Lip model weights | **Downloaded on first use** (too large to bundle) | ~400 MB |

> ⚠️ **Critical:** Do NOT require users to install Python, FFmpeg, or any other tool. The app must work out of the box on a fresh macOS or Windows machine.

### 9.2 Installer Targets

| Platform | Format | Target Size | Signing Required |
|----------|--------|-------------|-----------------|
| macOS | `.dmg` (universal binary) | ~120 MB | Apple Developer ID (Gatekeeper) |
| Windows | `.msi` or NSIS `.exe` | ~100 MB | Code signing cert (recommended) |

### 9.3 Tauri Config Highlights (tauri.conf.json)

```json
{
  "bundle": {
    "identifier": "com.yourname.videodub",
    "resources": [
      "resources/ffmpeg",
      "resources/yt-dlp",
      "resources/python/"
    ],
    "externalBin": ["sidecar/main"],
    "macOS": {
      "minimumSystemVersion": "10.15"
    }
  },
  "allowlist": {
    "shell": {
      "sidecar": true,
      "execute": false
    },
    "dialog": {
      "open": true,
      "save": true
    },
    "fs": {
      "all": true,
      "scope": ["$APPDATA/**", "$TEMP/**"]
    }
  }
}
```

### 9.4 Settings File Location

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/videodub/settings.json` |
| Windows | `%APPDATA%\videodub\settings.json` |

Tauri's `$APPDATA` variable resolves to the correct path on each platform automatically.

---

## 10. Error Handling & Edge Cases

| Error Scenario | Expected Behavior |
|---------------|------------------|
| YouTube URL is private or geo-blocked | Show: *"Could not download video. Check the URL or try a local file."* |
| Whisper API timeout (>60s) | Retry once with exponential backoff. If second attempt fails, show error with retry button. |
| Translation returns wrong segment count | Log warning, attempt best-effort alignment by index. Mark output as *"potentially misaligned"*. |
| TTS audio is >2x longer than original segment | Truncate at original duration. Log warning in the results summary. |
| Wav2Lip model weights not found | Prompt download dialog. Do not proceed with lip sync until download is verified. |
| Sync Labs API returns error | Show error message. Offer to re-run without lip sync. |
| Disk space < 2 GB available | Warn user before starting. Require confirmation to proceed. |
| Invalid or missing API key | Highlight the relevant field in Settings. Show: *"API key is invalid or missing."* |
| GPU not available (Wav2Lip) | Auto fall back to CPU. Show notice: *"Running on CPU — this may take longer."* |
| Job cancelled by user | Kill sidecar subprocess. Delete all temp files. Return to Main Screen. |
| Unsupported video format | Validate before starting. Show: *"Unsupported format. Please use MP4, MKV, MOV, AVI, or WebM."* |
| Sync Labs poll timeout (>10 min) | Abort lip sync. Offer to deliver video without lip sync applied. |

---

## 11. Recommended Development Phases

| Phase | Goal | Deliverable |
|-------|------|-------------|
| **Phase 1** | Core pipeline — no UI | Python sidecar processes a video end-to-end in Budget mode without lip sync. CLI only. |
| **Phase 2** | Basic Tauri UI | Home + Progress + Results screens. IPC working. Settings screen with API keys. |
| **Phase 3** | Mode toggle | Budget/Premium toggle fully wired. Cost estimate badge. Both modes tested end-to-end. |
| **Phase 4** | Lip sync integration | Lip sync toggle in Settings. Wav2Lip working locally. Sync Labs API integrated for Premium. |
| **Phase 5** | Packaging | One-click installers for Mac and Windows. All dependencies bundled. No external installs required. |
| **Phase 6** | Polish | Error handling, retry logic, GPU detection, model download flow, progress UX polish. |

---

## 12. Key Notes for the AI Developer

Read these carefully before writing any code:

1. **Start with the Python sidecar (Phase 1).** Get the pipeline working on the command line first before touching any UI code.

2. **Use `ffmpeg-python` library** for FFmpeg calls — do NOT shell out to FFmpeg manually with `subprocess`. It handles argument escaping and cross-platform paths correctly.

3. **OpenRouter is OpenAI-compatible.** Use the `openai` Python library but set `base_url='https://openrouter.ai/api/v1'` and the OpenRouter key as `api_key`. No other changes needed.

4. **For Whisper transcription,** check if OpenRouter exposes an audio transcription endpoint. If not, use the OpenAI SDK directly with the OpenAI API key — the cost is identical ($0.006/min). Always request word-level timestamps (`timestamp_granularities=["word"]`).

5. **KIE AI TTS API:** The user has API access. Check the KIE AI documentation for the exact endpoint and request format — do NOT guess the endpoint URL.

6. **ElevenLabs:** Use the `elevenlabs` Python SDK (`pip install elevenlabs`). For the target language, select a voice that supports that language. Always use the **Multilingual v2** model.

7. **Audio timing alignment:** Always use FFmpeg's `atempo` filter. Do NOT use pydub's `speedup()` — it has poor quality. The `atempo` filter sounds natural.

8. **Wav2Lip requires face detection.** Use the provided `s3fd` face detection model. If no face is detected in a video frame, Wav2Lip skips that frame — this is expected behavior, not a bug.

9. **Sync Labs is async.** POST the job, then poll `GET /v2/generate/{id}` every 5 seconds until `status == "completed"`. Implement a timeout of 10 minutes maximum.

10. **All temp files** must go to a job-specific temp directory: `{app_temp}/{job_id}/`. Clean up this directory on job completion AND on cancellation.

11. **The lip sync toggle state is passed per-job via JSON-RPC.** Do not read it from a global config file inside the sidecar. The frontend is the source of truth for all job parameters.

12. **Settings are stored** in `{app_data}/settings.json`. Tauri's `fs` API resolves `$APPDATA` to the correct platform path automatically. Load settings on app start, save on every change.

---

## Appendix A: Language Codes Reference (Common Pairs)

| Language | ISO 639-1 Code | Whisper Code |
|----------|---------------|--------------|
| Hindi | `hi` | `hi` |
| English | `en` | `en` |
| Spanish | `es` | `es` |
| Arabic | `ar` | `ar` |
| French | `fr` | `fr` |
| German | `de` | `de` |
| Portuguese | `pt` | `pt` |
| Russian | `ru` | `ru` |
| Japanese | `ja` | `ja` |
| Chinese (Simplified) | `zh` | `zh` |
| Korean | `ko` | `ko` |
| Bengali | `bn` | `bn` |
| Urdu | `ur` | `ur` |
| Tamil | `ta` | `ta` |
| Telugu | `te` | `te` |

---

## Appendix B: Useful Commands for Development

```bash
# Run the Python sidecar in CLI test mode
python sidecar/main.py --test --video input.mp4 --src hi --tgt en --mode budget

# Check FFmpeg is working
ffmpeg -i input.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 output.wav

# Test yt-dlp download
yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]" "https://youtube.com/watch?v=..." -o output.mp4

# Test atempo filter
ffmpeg -i tts_segment.wav -filter:a "atempo=1.25" aligned_segment.wav

# Build Tauri app (development)
npm run tauri dev

# Build Tauri installer (production)
npm run tauri build
```

---

*End of Specification — Video Dubbing Desktop App v1.0*
