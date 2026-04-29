import { useState } from 'react'
import { useJobStore } from './store/useJobStore'
import { ModeToggle } from './components/ModeToggle'
import { HomeScreen } from './screens/HomeScreen'
import { ProgressScreen } from './screens/ProgressScreen'
import { ResultScreen } from './screens/ResultScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export default function App() {
  const { status } = useJobStore()
  const [settingsOpen, setSettingsOpen] = useState(false)

  function renderScreen() {
    if (status === 'running') return <ProgressScreen />
    if (status === 'done') return <ResultScreen />
    return <HomeScreen />
  }

  return (
    <div className="app-root">
      {/* ─── Header ─── */}
      <header className="app-header">
        <div className="app-header__logo">
          <span className="app-logo-icon">🎬</span>
          <span className="app-logo-text">VideoDub<span className="app-logo-ai">AI</span></span>
        </div>

        <div className="app-header__center">
          <ModeToggle />
        </div>

        <div className="app-header__right">
          <button
            id="open-settings"
            className="settings-icon-btn"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            type="button"
            aria-label="Open settings"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <div className="app-content">
        {renderScreen()}
      </div>

      {/* ─── Settings Overlay ─── */}
      {settingsOpen && <SettingsScreen onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}
