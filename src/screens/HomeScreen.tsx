import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useJobStore } from '../store/useJobStore'
import { DropZone } from '../components/DropZone'
import { LanguageSelect } from '../components/LanguageSelect'
import { estimateCost, formatCostRange, estimateTimeMins } from '../lib/cost'
import { startJob, JobConfig } from '../lib/sidecar'

export function HomeScreen() {
  const { mode, settings, sourceLang, targetLang, videoPath, youtubeUrl, setYoutubeUrl } =
    useAppStore()
  const { status } = useJobStore()
  const [validationError, setValidationError] = useState<string | null>(null)

  const videoDurationSec = 300 // We don't know until download; use placeholder for estimate
  const estimate = estimateCost(videoDurationSec, mode, settings.lipSyncEnabled)
  const timeMins = estimateTimeMins(videoDurationSec, mode, settings.lipSyncEnabled)

  async function handleStartDubbing() {
    setValidationError(null)

    if (!videoPath && !youtubeUrl.trim()) {
      setValidationError('Please drop a video file or paste a YouTube URL.')
      return
    }
    if (!settings.openrouterKey) {
      setValidationError('OpenRouter API key is required. Please add it in Settings.')
      return
    }
    if (mode === 'budget' && !settings.kieAiKey) {
      setValidationError('KIE AI API key is required for Budget TTS. Please add it in Settings.')
      return
    }
    if (mode === 'premium' && !settings.elevenLabsKey) {
      setValidationError('ElevenLabs API key is required for Premium TTS. Please add it in Settings.')
      return
    }
    if (mode === 'premium' && settings.lipSyncEnabled && !settings.syncLabsKey) {
      setValidationError('Sync Labs API key is required for Premium Lip Sync. Please add it in Settings.')
      return
    }

    const jobId = `job_${Date.now()}`
    const config: JobConfig = {
      id: jobId,
      cmd: 'start_job',
      params: {
        video_path: videoPath,
        youtube_url: youtubeUrl.trim() || null,
        source_lang: sourceLang,
        target_lang: targetLang,
        mode,
        lip_sync_enabled: settings.lipSyncEnabled,
        lip_sync_engine: settings.lipSyncEngine,
        api_keys: {
          openrouter: settings.openrouterKey,
          kie_ai: settings.kieAiKey,
          elevenlabs: settings.elevenLabsKey || null,
          sync_labs: settings.syncLabsKey || null,
        },
      },
    }

    try {
      await startJob(config)
    } catch (err) {
      setValidationError(`Failed to start job: ${String(err)}`)
    }
  }

  return (
    <main className="home-screen">
      <section className="input-panel card">
        <DropZone onFileSelect={() => setValidationError(null)} />

        <div className="youtube-input-wrapper">
          <span className="youtube-input-label">Or paste YouTube URL</span>
          <input
            id="youtube-url"
            type="url"
            className="youtube-input"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => {
              setYoutubeUrl(e.target.value)
              setValidationError(null)
            }}
          />
        </div>
      </section>

      <section className="language-panel card">
        <LanguageSelect />
      </section>

      <section className="action-bar">
        {validationError && (
          <div className="action-bar__error" role="alert">
            ⚠ {validationError}
          </div>
        )}
        <div className="action-bar__estimates">
          <span className="estimate-badge">
            💰 Est. cost: <strong>~{formatCostRange(estimate)}</strong>
          </span>
          <span className="estimate-badge">
            ⏱ Est. time: <strong>~{timeMins} min</strong>
          </span>
        </div>
        <button
          id="start-dubbing"
          className={`start-btn ${mode === 'premium' ? 'start-btn--premium' : 'start-btn--budget'}`}
          onClick={handleStartDubbing}
          disabled={status === 'running'}
          type="button"
        >
          {status === 'running' ? '⟳ Processing...' : '🎙 Start Dubbing'}
        </button>
      </section>
    </main>
  )
}
