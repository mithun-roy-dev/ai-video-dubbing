import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Settings {
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

interface AppState {
  mode: 'budget' | 'premium'
  settings: Settings
  sourceLang: string
  targetLang: string
  videoPath: string | null
  youtubeUrl: string
  setMode: (mode: 'budget' | 'premium') => void
  updateSettings: (partial: Partial<Settings>) => void
  setSourceLang: (lang: string) => void
  setTargetLang: (lang: string) => void
  setVideoPath: (path: string | null) => void
  setYoutubeUrl: (url: string) => void
}

const defaultSettings: Settings = {
  openrouterKey: '',
  kieAiKey: '',
  elevenLabsKey: '',
  syncLabsKey: '',
  lipSyncEnabled: false,
  lipSyncEngine: 'wav2lip',
  outputDir: '',
  keepTempFiles: false,
  gpuEnabled: true,
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: 'budget',
      settings: defaultSettings,
      sourceLang: 'hi',
      targetLang: 'en',
      videoPath: null,
      youtubeUrl: '',
      setMode: (mode) => set({ mode }),
      updateSettings: (partial) =>
        set((state) => ({ settings: { ...state.settings, ...partial } })),
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
        sourceLang: state.sourceLang,
        targetLang: state.targetLang,
      }),
    }
  )
)
