import { create } from 'zustand'

interface JobResult {
  outputPath: string
  costUsd: number
  durationSec: number
}

interface JobState {
  jobId: string | null
  status: 'idle' | 'running' | 'done' | 'error' | 'cancelled'
  currentStep: number
  currentStepName: string
  pct: number
  logs: string[]
  result: JobResult | null
  error: string | null

  startJob: (jobId: string) => void
  updateProgress: (step: number, stepName: string, pct: number, message: string) => void
  appendLog: (message: string) => void
  setResult: (result: { output_path: string; cost_usd: number; duration_sec: number }) => void
  setError: (error: string) => void
  cancelJob: () => void
  resetJob: () => void
}

export const useJobStore = create<JobState>()((set) => ({
  jobId: null,
  status: 'idle',
  currentStep: 0,
  currentStepName: '',
  pct: 0,
  logs: [],
  result: null,
  error: null,

  startJob: (jobId) =>
    set({ jobId, status: 'running', currentStep: 0, currentStepName: '', pct: 0, logs: [], result: null, error: null }),

  updateProgress: (step, stepName, pct, message) =>
    set((state) => ({
      currentStep: step,
      currentStepName: stepName,
      pct,
      logs: [...state.logs, message].slice(-200), // keep last 200 log lines
    })),

  appendLog: (message) =>
    set((state) => ({ logs: [...state.logs, message].slice(-200) })),

  setResult: (event) =>
    set({
      status: 'done',
      result: {
        outputPath: event.output_path,
        costUsd: event.cost_usd,
        durationSec: event.duration_sec,
      },
    }),

  setError: (error) => set({ status: 'error', error }),

  cancelJob: () => set({ status: 'cancelled', jobId: null }),

  resetJob: () =>
    set({
      jobId: null,
      status: 'idle',
      currentStep: 0,
      currentStepName: '',
      pct: 0,
      logs: [],
      result: null,
      error: null,
    }),
}))
