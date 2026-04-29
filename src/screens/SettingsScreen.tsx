import { useAppStore } from '../store/useAppStore'
import { pickFolder } from '../tauri-commands/fileDialog'
import { ApiProviderSection } from '../components/ApiProviderSection'

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  id: string
  checked: boolean
  onChange: (val: boolean) => void
  label: string
  sublabel?: string
  disabled?: boolean
}

function Toggle({ id, checked, onChange, label, sublabel, disabled }: ToggleProps) {
  return (
    <div className={`toggle-row ${disabled ? 'toggle-row--disabled' : ''}`}>
      <div className="toggle-row__info">
        <label htmlFor={id} className="toggle-row__label">{label}</label>
        {sublabel && <p className="toggle-row__sublabel">{sublabel}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        className={`toggle-switch ${checked ? 'toggle-switch--on' : ''}`}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        type="button"
      >
        <span className="toggle-switch__thumb" />
      </button>
    </div>
  )
}

// ─── Settings Screen ──────────────────────────────────────────────────────────

interface SettingsScreenProps {
  onClose: () => void
}

export function SettingsScreen({ onClose }: SettingsScreenProps) {
  const { settings, updateSettings } = useAppStore()

  async function handlePickOutputDir() {
    const folder = await pickFolder()
    if (folder) updateSettings({ outputDir: folder })
  }

  return (
    <div className="settings-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="settings-panel" role="dialog" aria-label="Settings">
        <div className="settings-panel__header">
          <h2 className="settings-panel__title">⚙ Settings</h2>
          <button id="close-settings" className="settings-close-btn" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div className="settings-panel__body">

          {/* ─── Section A: API Providers (new per-step configurator) ─── */}
          <ApiProviderSection />

          {/* ─── Section B: Pipeline Options ─── */}
          <section className="settings-section">
            <h3 className="settings-section__title">⚙ Pipeline Options</h3>

            <Toggle
              id="lip-sync-toggle"
              checked={settings.lipSyncEnabled}
              onChange={(v) => updateSettings({ lipSyncEnabled: v })}
              label="Enable Lip Sync (Step 7)"
              sublabel="Animates speaker mouth movements to match the dubbed audio. Increases processing time."
            />

            <div className="settings-field">
              <label className="settings-label">Output Directory</label>
              <div className="folder-picker">
                <input
                  id="output-dir"
                  className="folder-picker__input"
                  value={settings.outputDir || '~/Downloads (default)'}
                  readOnly
                />
                <button
                  id="pick-output-dir"
                  className="folder-picker__btn"
                  onClick={handlePickOutputDir}
                  type="button"
                >
                  Browse...
                </button>
              </div>
            </div>

            <Toggle
              id="keep-temp-files"
              checked={settings.keepTempFiles}
              onChange={(v) => updateSettings({ keepTempFiles: v })}
              label="Keep Temp Files"
              sublabel="Useful for debugging — keeps intermediate audio/video files after a job completes."
            />

            <Toggle
              id="gpu-acceleration"
              checked={settings.gpuEnabled}
              onChange={(v) => updateSettings({ gpuEnabled: v })}
              label="GPU Acceleration"
              sublabel="Enable CUDA for Wav2Lip. Automatically disabled if no compatible GPU is detected."
            />
          </section>
        </div>
      </div>
    </div>
  )
}
