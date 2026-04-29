import { useJobStore } from '../store/useJobStore'
import { useAppStore } from '../store/useAppStore'
import { getLanguageName } from '../lib/languages'
import { openInExplorer, saveVideoAs } from '../tauri-commands/fileDialog'

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function ResultScreen() {
  const { result, resetJob } = useJobStore()
  const { mode, sourceLang, targetLang } = useAppStore()

  if (!result) return null

  const currentResult = result
  const fileName = currentResult.outputPath.split(/[\\/]/).pop() ?? 'dubbed_output.mp4'

  async function handleSave() {
    const defaultName = `${targetLang}_dubbed_${Date.now()}.mp4`
    const savePath = await saveVideoAs(defaultName)
    if (savePath) {
      const { copyFile } = await import('@tauri-apps/plugin-fs')
      await copyFile(currentResult.outputPath, savePath)
    }
  }

  async function handleOpenInExplorer() {
    await openInExplorer(currentResult.outputPath)
  }

  function handleDubAnother() {
    resetJob()
  }

  return (
    <main className="result-screen">
      <div className="result-screen__hero">
        <div className="result-success-badge">✅</div>
        <h2 className="result-screen__title">Dubbing Complete!</h2>
        <p className="result-screen__subtitle">Your dubbed video is ready.</p>
      </div>

      <div className="card result-player-card">
        <video
          id="result-video"
          className="result-video"
          src={`asset://${currentResult.outputPath}`}
          controls
          preload="metadata"
        />
        <p className="result-filename">{fileName}</p>
      </div>

      <div className="card result-summary-card">
        <h3 className="result-summary__title">Summary</h3>
        <table className="result-summary-table">
          <tbody>
            <tr>
              <td>Source language</td>
              <td><strong>{getLanguageName(sourceLang)}</strong></td>
            </tr>
            <tr>
              <td>Target language</td>
              <td><strong>{getLanguageName(targetLang)}</strong></td>
            </tr>
            <tr>
              <td>Duration</td>
              <td><strong>{formatDuration(currentResult.durationSec)}</strong></td>
            </tr>
            <tr>
              <td>Mode used</td>
              <td>
                <span className={`mode-pill mode-pill--${mode}`}>
                  {mode === 'budget' ? '⚡ Budget' : '✦ Premium'}
                </span>
              </td>
            </tr>
            <tr>
              <td>Total API cost</td>
              <td><strong>~${currentResult.costUsd.toFixed(3)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="result-screen__actions">
        <button id="save-video" className="btn btn--primary" onClick={handleSave} type="button">
          💾 Save Video
        </button>
        <button
          id="open-in-explorer"
          className="btn btn--secondary"
          onClick={handleOpenInExplorer}
          type="button"
        >
          📂 Open in Explorer
        </button>
        <button
          id="dub-another"
          className="btn btn--ghost"
          onClick={handleDubAnother}
          type="button"
        >
          🔄 Dub Another Video
        </button>
      </div>
    </main>
  )
}
