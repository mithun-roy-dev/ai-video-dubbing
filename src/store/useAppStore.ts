import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Provider & Model Definitions ────────────────────────────────────────────

export interface ModelOption {
  id: string
  label: string
}

export interface ProviderDef {
  id: string
  label: string
  defaultApiPath: string
  models: ModelOption[]
  apiKeyRequired: boolean
  apiKeyHint?: string
  apiKeyPlaceholder?: string
}

export const PROVIDER_DEFS: Record<string, ProviderDef> = {
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultApiPath: 'https://openrouter.ai/api/v1',
    apiKeyRequired: true,
    apiKeyHint: 'https://openrouter.ai/keys',
    apiKeyPlaceholder: 'sk-or-...',
    models: [],
  },
  kie_ai: {
    id: 'kie_ai',
    label: 'KIE AI',
    defaultApiPath: 'https://api.kie.ai/v1',
    apiKeyRequired: true,
    apiKeyHint: 'https://kie.ai/dashboard',
    apiKeyPlaceholder: 'kie-...',
    models: [],
  },
  elevenlabs: {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    defaultApiPath: 'https://api.elevenlabs.io/v1',
    apiKeyRequired: true,
    apiKeyHint: 'https://elevenlabs.io/api',
    apiKeyPlaceholder: 'el-...',
    models: [
      { id: 'eleven_multilingual_v2', label: 'Multilingual v2' },
      { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5 (faster)' },
      { id: 'eleven_monolingual_v1', label: 'Monolingual v1 (English)' },
    ],
  },
  wav2lip: {
    id: 'wav2lip',
    label: 'Wav2Lip (local)',
    defaultApiPath: '',
    apiKeyRequired: false,
    models: [
      { id: 'wav2lip', label: 'Wav2Lip (standard)' },
      { id: 'wav2lip_gan', label: 'Wav2Lip + GAN (better quality)' },
    ],
  },
  synclabs: {
    id: 'synclabs',
    label: 'Sync Labs',
    defaultApiPath: 'https://api.sync.so/v2/generate',
    apiKeyRequired: true,
    apiKeyHint: 'https://sync.so/dashboard',
    apiKeyPlaceholder: 'sync-...',
    models: [
      { id: 'lipsync-2', label: 'LipSync 2 (latest)' },
      { id: 'lipsync-1.9.0-beta', label: 'LipSync 1.9 (beta)' },
    ],
  },
}

// Per-step: models loaded from provider + custom optional overrides
export const STEP_PROVIDERS: Record<string, string[]> = {
  transcription: ['openrouter', 'kie_ai'],
  translation:   ['openrouter', 'kie_ai'],
  tts:           ['kie_ai', 'elevenlabs'],
  lipsync:       ['wav2lip', 'synclabs'],
}

// Default models per provider per step
export const STEP_DEFAULT_MODELS: Record<string, Record<string, ModelOption[]>> = {
  transcription: {
    openrouter: [
      { id: 'openai/whisper-large-v3', label: 'Whisper Large v3 (best)' },
      { id: 'openai/whisper-large-v2', label: 'Whisper Large v2' },
      { id: 'openai/whisper-medium', label: 'Whisper Medium (faster)' },
    ],
    kie_ai: [
      { id: 'whisper-large-v3', label: 'Whisper Large v3' },
      { id: 'whisper-medium', label: 'Whisper Medium' },
    ],
  },
  translation: {
    openrouter: [
      { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (free)' },
      { id: 'google/gemini-flash-1.5', label: 'Gemini 1.5 Flash' },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'openai/gpt-4o', label: 'GPT-4o' },
      { id: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
      { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
    ],
    kie_ai: [
      { id: 'gemini-flash', label: 'Gemini Flash (via KIE)' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini (via KIE)' },
    ],
  },
  tts: {
    kie_ai: [
      { id: 'kie-tts-v1', label: 'KIE TTS v1 (multilingual)' },
      { id: 'kie-tts-v2', label: 'KIE TTS v2 (expressive)' },
    ],
    elevenlabs: [
      { id: 'eleven_multilingual_v2', label: 'Multilingual v2' },
      { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5 (fastest)' },
      { id: 'eleven_monolingual_v1', label: 'Monolingual v1 (EN only)' },
    ],
  },
  lipsync: {
    wav2lip: [
      { id: 'wav2lip', label: 'Wav2Lip (standard)' },
      { id: 'wav2lip_gan', label: 'Wav2Lip + GAN (better quality)' },
    ],
    synclabs: [
      { id: 'lipsync-2', label: 'LipSync 2 (latest)' },
      { id: 'lipsync-1.9.0-beta', label: 'LipSync 1.9 (beta)' },
    ],
  },
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StepProviderConfig {
  provider: string   // e.g. 'openrouter'
  model: string      // e.g. 'openai/whisper-large-v3'
  apiPath: string    // base URL override
  apiKey: string
}

export interface ApiProviders {
  transcription: StepProviderConfig
  translation: StepProviderConfig
  tts: StepProviderConfig
  lipsync: StepProviderConfig
}

interface Settings {
  lipSyncEnabled: boolean
  outputDir: string
  keepTempFiles: boolean
  gpuEnabled: boolean
}

interface AppState {
  mode: 'budget' | 'premium'
  settings: Settings
  apiProviders: ApiProviders
  sourceLang: string
  targetLang: string
  videoPath: string | null
  youtubeUrl: string
  setMode: (mode: 'budget' | 'premium') => void
  updateSettings: (partial: Partial<Settings>) => void
  updateStepProvider: (step: keyof ApiProviders, partial: Partial<StepProviderConfig>) => void
  setSourceLang: (lang: string) => void
  setTargetLang: (lang: string) => void
  setVideoPath: (path: string | null) => void
  setYoutubeUrl: (url: string) => void
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const defaultSettings: Settings = {
  lipSyncEnabled: false,
  outputDir: '',
  keepTempFiles: false,
  gpuEnabled: true,
}

const defaultApiProviders: ApiProviders = {
  transcription: {
    provider: 'openrouter',
    model: 'openai/whisper-large-v3',
    apiPath: 'https://openrouter.ai/api/v1',
    apiKey: '',
  },
  translation: {
    provider: 'openrouter',
    model: 'google/gemini-2.0-flash-exp:free',
    apiPath: 'https://openrouter.ai/api/v1',
    apiKey: '',
  },
  tts: {
    provider: 'kie_ai',
    model: 'kie-tts-v1',
    apiPath: 'https://api.kie.ai/v1',
    apiKey: '',
  },
  lipsync: {
    provider: 'wav2lip',
    model: 'wav2lip',
    apiPath: '',
    apiKey: '',
  },
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: 'budget',
      settings: defaultSettings,
      apiProviders: defaultApiProviders,
      sourceLang: 'hi',
      targetLang: 'en',
      videoPath: null,
      youtubeUrl: '',
      setMode: (mode) => set({ mode }),
      updateSettings: (partial) =>
        set((state) => ({ settings: { ...state.settings, ...partial } })),
      updateStepProvider: (step, partial) =>
        set((state) => ({
          apiProviders: {
            ...state.apiProviders,
            [step]: { ...state.apiProviders[step], ...partial },
          },
        })),
      setSourceLang: (lang) => set({ sourceLang: lang }),
      setTargetLang: (lang) => set({ targetLang: lang }),
      setVideoPath: (path) => set({ videoPath: path }),
      setYoutubeUrl: (url) => set({ youtubeUrl: url }),
    }),
    {
      name: 'videodub-app-store',
      partialize: (state) => ({
        mode: state.mode,
        settings: state.settings,
        apiProviders: state.apiProviders,
        sourceLang: state.sourceLang,
        targetLang: state.targetLang,
      }),
    }
  )
)
