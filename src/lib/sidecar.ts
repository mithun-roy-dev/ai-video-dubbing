import { Command } from '@tauri-apps/plugin-shell'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sidecarChild: any = null

/**
 * Start a dubbing job by spawning the Python sidecar process
 * and sending the job config via stdin (JSON-RPC over stdio).
 */
export async function startJob(config: JobConfig): Promise<void> {
  const store = useJobStore.getState()
  store.startJob(config.id)

  const command = Command.sidecar('binaries/sidecar')

  command.stdout.on('data', (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return

    try {
      const event = JSON.parse(trimmed)

      if (event.event === 'progress') {
        store.updateProgress(event.step, event.step_name, event.pct, event.message)
      }
      if (event.event === 'done') {
        store.setResult(event)
        sidecarChild = null
      }
      if (event.event === 'error') {
        store.setError(event.message)
        sidecarChild = null
      }
    } catch {
      // Non-JSON debug lines — just append to log
      store.appendLog(trimmed)
    }
  })

  command.stderr.on('data', (line: string) => {
    store.appendLog(`[stderr] ${line.trim()}`)
  })

  sidecarChild = await command.spawn()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (command as any).stdin?.write(JSON.stringify(config) + '\n')
}

/**
 * Cancel the currently running sidecar process gracefully.
 */
export async function cancelJob(): Promise<void> {
  if (sidecarChild) {
    await sidecarChild.kill()
    sidecarChild = null
    useJobStore.getState().cancelJob()
  }
}
