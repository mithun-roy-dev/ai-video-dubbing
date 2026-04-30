import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useJobStore } from '../store/useJobStore'
import { DropZone } from '../components/DropZone'
import { LanguageSelect } from '../components/LanguageSelect'
import { estimateCost, formatCostRange, estimateTimeMins } from '../lib/cost'
import { startJob, buildApiProvidersPayload, type JobConfig } from '../lib/sidecar'

export function HomeScreen() {
  const { mode, settings, apiProviders, sourceLang, targetLang, videoPath, youtubeUrl, setYoutubeUrl } =
    useAppStore()
  const { status } = useJobStore()
  const [validationError, setValidationError] = useState<string | null>(null)

  const videoDurationSec = 300
  const estimate = estimateCost(videoDurationSec, mode, settings.lipSyncEnabled)
  const timeMins = estimateTimeMins(videoDurationSec, mode, settings.lipSyncEnabled)

  function validateApiProviders(): string | null {
    if (!apiProviders.transcription.apiKey)
      return 'Transcription API key is missing. Please configure it in Settings → API Providers.'
    if (!apiProviders.translation.apiKey)
      return 'Translation API key is missing. Please configure it in Settings → API Providers.'
    if (!apiProviders.tts.apiKey)
      return 'TTS API key is missing. Please configure it in Settings → API Providers.'
    if (settings.lipSyncEnabled && apiProviders.lipsync.provider === 'synclabs' && !apiProviders.lipsync.apiKey)
      return 'Sync Labs API key is missing. Please configure it in Settings → API Providers.'
    return null
  }

  async function handleStartDubbing() {
    setValidationError(null)

    if (!videoPath && !youtubeUrl.trim()) {
      setValidationError('Please drop a video file or paste a YouTube URL.')
      return
    }

    const providerErr = validateApiProviders()
    if (providerErr) {
      setValidationError(providerErr)
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
        gpu_enabled: settings.gpuEnabled,
        keep_temp_files: settings.keepTempFiles,
        output_dir: settings.outputDir || null,
        api_providers: buildApiProvidersPayload(apiProviders),
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
        <DropZone
          onFileSelect={(path) => {
            setValidationError(null)
            setYoutubeUrl('') // Clear YouTube URL when file is selected
          }}
        />


        <div className="youtube-input-wrapper">
          <span className="youtube-input-label">Or paste YouTube URL</span>
          <input
            id="youtube-url"
            type="url"
            className="youtube-input"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => {
              const url = e.target.value
              setYoutubeUrl(url)
              setValidationError(null)
              if (url.trim()) {
                useAppStore.getState().setVideoPath(null) // Clear video path when URL is entered
              }
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
