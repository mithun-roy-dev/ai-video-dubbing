import { useJobStore } from '../store/useJobStore'
import { getLanguageName } from '../lib/languages'
import { useAppStore } from '../store/useAppStore'
import { revealItemInDir } from '@tauri-apps/plugin-opener'

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

  return (
    <main className="result-screen">
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '10px' }}>✅</h1>
        <h2 style={{ fontSize: '24px', color: '#fff' }}>Dubbing Complete!</h2>
        <p style={{ opacity: 0.7, marginBottom: '30px' }}>
          Your video was saved to your <strong>Videos/VideoDubAI</strong> folder.
        </p>

        <div className="card" style={{ maxWidth: '400px', margin: '0 auto 30px', textAlign: 'left', padding: '20px' }}>
          <p style={{ margin: '5px 0' }}><strong>From:</strong> {getLanguageName(sourceLang)}</p>
          <p style={{ margin: '5px 0' }}><strong>To:</strong> {getLanguageName(targetLang)}</p>
          <p style={{ margin: '5px 0', fontSize: '12px', opacity: 0.6, wordBreak: 'break-all' }}>
            <strong>Path:</strong> {result.outputPath}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button 
            className="btn btn--primary" 
            onClick={handleOpenFolder}
            style={{ padding: '12px 24px' }}
          >
            📂 Open in Explorer
          </button>
          <button 
            className="btn btn--ghost" 
            onClick={resetJob}
            style={{ padding: '12px 24px' }}
          >
            🔄 Dub Another
          </button>
        </div>
      </div>
    </main>
  )
}
