import { useJobStore } from '../store/useJobStore'
import { getLanguageName } from '../lib/languages'
import { useAppStore } from '../store/useAppStore'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { convertFileSrc } from '@tauri-apps/api/core'

export function ResultScreen() {
  const { result, resetJob } = useJobStore()
  const { sourceLang, targetLang } = useAppStore()

  if (!result) return null

  const handleOpenFolder = async () => {
    try {
      await revealItemInDir(result.outputPath)
    } catch (err) {
      console.error('Failed to open folder:', err)
    }
  }

  const videoSrc = convertFileSrc(result.outputPath)

  return (
    <main className="result-screen">
      <div className="result-container">
        <div className="result-header">
          <div className="success-badge">
            <span className="success-check">✓</span>
          </div>
          <h2 className="result-title">Dubbing Complete!</h2>
          <p className="result-subtitle">
            Your dubbed video is ready. We've saved it to your selected output directory.
          </p>
        </div>

        <div className="result-grid">
          {/* Video Preview */}
          <div className="result-video-card card">
            <div className="video-player-container">
              <video 
                src={videoSrc} 
                controls 
                className="result-video-player"
                poster="/preview-placeholder.png"
              />
            </div>
            <div className="video-card-footer">
              <div className="file-info">
                <span className="file-icon">🎬</span>
                <span className="file-path" title={result.outputPath}>
                  {result.outputPath.split(/[\\/]/).pop()}
                </span>
              </div>
            </div>
          </div>

          {/* Job Summary */}
          <div className="result-info-panel">
            <div className="summary-card card">
              <h3 className="summary-title">Job Summary</h3>
              <div className="summary-list">
                <div className="summary-item">
                  <span className="summary-label">Source Language</span>
                  <span className="summary-value">{getLanguageName(sourceLang)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Target Language</span>
                  <span className="summary-value">{getLanguageName(targetLang)}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Duration</span>
                  <span className="summary-value">{result.durationSec}s</span>
                </div>
                <div className="summary-divider" />
                <div className="summary-item summary-item--highlight">
                  <span className="summary-label">Total Cost</span>
                  <span className="summary-value cost-value">
                    ${result.costUsd.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>

            <div className="result-actions">
              <button 
                className="btn btn--primary btn--full" 
                onClick={handleOpenFolder}
              >
                📂 Open in Explorer
              </button>
              <button 
                className="btn btn--ghost btn--full" 
                onClick={resetJob}
              >
                🔄 Dub Another Video
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
