import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useJobStore } from '../store/useJobStore'
import type { ApiProviders } from '../store/useAppStore'

export interface StepProviderPayload {
  provider: string
  model: string
  api_path: string
  api_key: string
}

export interface JobConfig {
  id: string
  cmd: 'start_job'
  params: {
    video_path: string | null
    youtube_url: string | null
    source_lang: string
    target_lang: string
    mode: 'budget' | 'premium'
    lip_sync_enabled: boolean
    gpu_enabled: boolean
    keep_temp_files: boolean
    output_dir: string | null
    /** Per-step provider settings — replaces the flat api_keys map */
    api_providers: {
      transcription: StepProviderPayload
      translation: StepProviderPayload
      tts: StepProviderPayload
      lipsync: StepProviderPayload
    }
  }
}

/** Convert store's camelCase ApiProviders to snake_case payload for Python sidecar */
export function buildApiProvidersPayload(
  apiProviders: ApiProviders
): JobConfig['params']['api_providers'] {
  return {
    transcription: {
      provider: apiProviders.transcription.provider,
      model: apiProviders.transcription.model,
      api_path: apiProviders.transcription.apiPath,
      api_key: apiProviders.transcription.apiKey,
    },
    translation: {
      provider: apiProviders.translation.provider,
      model: apiProviders.translation.model,
      api_path: apiProviders.translation.apiPath,
      api_key: apiProviders.translation.apiKey,
    },
    tts: {
      provider: apiProviders.tts.provider,
      model: apiProviders.tts.model,
      api_path: apiProviders.tts.apiPath,
      api_key: apiProviders.tts.apiKey,
    },
    lipsync: {
      provider: apiProviders.lipsync.provider,
      model: apiProviders.lipsync.model,
      api_path: apiProviders.lipsync.apiPath,
      api_key: apiProviders.lipsync.apiKey,
    },
  }
}

// Tauri event listener unsubscribe handles
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let unlisteners: Array<() => void> = []

/**
 * Start a dubbing job by invoking the Rust spawn_python command,
 * which launches the Python sidecar and streams events back via Tauri events.
 */
export async function startJob(config: JobConfig): Promise<void> {
  const store = useJobStore.getState()
  store.startJob(config.id)

  console.log('[Sidecar] Starting job:', config)

  // Resolve script path: in dev, main.py is at <project-root>/sidecar/main.py
  // The Tauri process CWD is src-tauri/, so we go up one level.
  const scriptPath = '../sidecar/main.py'

  // Cleanup any previous listeners
  for (const unsub of unlisteners) unsub()
  unlisteners = []

  // Listen for stdout events from the Rust backend
  const unlistenStdout = await listen<string>('sidecar-stdout', (event) => {
    const line = event.payload.trim()
    if (!line) return
    console.log('[Sidecar STDOUT]:', line)

    try {
      const ev = JSON.parse(line)
      if (ev.event === 'progress') {
        store.updateProgress(ev.step, ev.step_name, ev.pct, ev.message)
      }
      if (ev.event === 'done') {
        store.setResult(ev)
      }
      if (ev.event === 'error') {
        store.setError(ev.message)
      }
    } catch {
      store.appendLog(line)
    }
  })

  // Listen for stderr events
  const unlistenStderr = await listen<string>('sidecar-stderr', (event) => {
    const line = event.payload.trim()
    console.error('[Sidecar STDERR]:', line)
    store.appendLog(`[stderr] ${line}`)
  })

  // Listen for process exit
  const unlistenExit = await listen('sidecar-exit', () => {
    console.log('[Sidecar] Process exited')
  })

  unlisteners = [unlistenStdout, unlistenStderr, unlistenExit]

  try {
    await invoke('spawn_python', {
      scriptPath,
      configJson: JSON.stringify(config),
    })
    console.log('[Sidecar] spawn_python invoked successfully')
  } catch (err) {
    console.error('[Sidecar] Failed to spawn:', err)
    store.setError(`Failed to start sidecar: ${err}`)
  }
}

/**
 * Cancel the currently running sidecar process.
 */
export async function cancelJob(): Promise<void> {
  try {
    await invoke('kill_python')
  } catch (e) {
    console.error('kill_python failed:', e)
  }
  for (const unsub of unlisteners) unsub()
  unlisteners = []
  useJobStore.getState().cancelJob()
}
