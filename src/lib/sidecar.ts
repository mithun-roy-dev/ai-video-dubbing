import { Command } from '@tauri-apps/plugin-shell'
import { useJobStore } from '../store/useJobStore'

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
    lip_sync_engine: 'wav2lip' | 'synclabs'
    api_keys: {
      openrouter: string
      kie_ai: string
      elevenlabs: string | null
      sync_labs: string | null
    }
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
