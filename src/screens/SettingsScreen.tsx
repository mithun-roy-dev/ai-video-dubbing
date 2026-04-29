import { useAppStore } from '../store/useAppStore'
import { pickFolder } from '../tauri-commands/fileDialog'

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

interface ApiKeyFieldProps {
  id: string
  label: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  hint?: string
  required?: boolean
}

function ApiKeyField({ id, label, value, onChange, placeholder, hint, required }: ApiKeyFieldProps) {
  return (
    <div className="api-key-field">
      <label htmlFor={id} className="api-key-field__label">
        {label}
        {required && <span className="required-star">*</span>}
      </label>
      {hint && (
        <a className="api-key-field__hint" href={hint} target="_blank" rel="noreferrer">
          Get key ↗
        </a>
      )}
      <input
        id={id}
        type="password"
        className={`api-key-field__input ${!value && required ? 'api-key-field__input--missing' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Paste API key here...'}
        autoComplete="off"
      />
      {!value && required && (
        <p className="api-key-field__error">API key is invalid or missing.</p>
      )}
    </div>
  )
}

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
          {/* ─── Section A: API Keys ─── */}
          <section className="settings-section">
            <h3 className="settings-section__title">🔑 API Keys</h3>

            <ApiKeyField
              id="openrouter-key"
              label="OpenRouter API Key"
              value={settings.openrouterKey}
              onChange={(v) => updateSettings({ openrouterKey: v })}
              hint="https://openrouter.ai/keys"
              placeholder="sk-or-..."
              required
            />
            <ApiKeyField
              id="kieai-key"
              label="KIE AI API Key"
              value={settings.kieAiKey}
              onChange={(v) => updateSettings({ kieAiKey: v })}
              hint="https://kie.ai/dashboard"
              placeholder="Budget TTS key..."
            />
            <ApiKeyField
              id="elevenlabs-key"
              label="ElevenLabs API Key"
              value={settings.elevenLabsKey}
              onChange={(v) => updateSettings({ elevenLabsKey: v })}
              hint="https://elevenlabs.io/api"
              placeholder="Premium TTS key..."
            />
            <ApiKeyField
              id="synclabs-key"
              label="Sync Labs API Key"
              value={settings.syncLabsKey}
              onChange={(v) => updateSettings({ syncLabsKey: v })}
              hint="https://sync.so/dashboard"
              placeholder="Premium lip sync key..."
            />
          </section>

          {/* ─── Section B: Pipeline Options ─── */}
          <section className="settings-section">
            <h3 className="settings-section__title">⚙ Pipeline Options</h3>

            <Toggle
              id="lip-sync-toggle"
              checked={settings.lipSyncEnabled}
              onChange={(v) => updateSettings({ lipSyncEnabled: v })}
              label="Enable Lip Sync Processing"
              sublabel="Animates speaker mouth movements to match dubbed audio. Increases processing time."
            />

            {settings.lipSyncEnabled && (
              <div className="settings-subsection">
                <label className="settings-label">Lip Sync Engine</label>
                <div className="radio-group">
                  <label className={`radio-option ${settings.lipSyncEngine === 'wav2lip' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="lip-sync-engine"
                      value="wav2lip"
                      checked={settings.lipSyncEngine === 'wav2lip'}
                      onChange={() => updateSettings({ lipSyncEngine: 'wav2lip' })}
                    />
                    Wav2Lip (local, free)
                  </label>
                  <label className={`radio-option ${settings.lipSyncEngine === 'synclabs' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="lip-sync-engine"
                      value="synclabs"
                      checked={settings.lipSyncEngine === 'synclabs'}
                      onChange={() => updateSettings({ lipSyncEngine: 'synclabs' })}
                    />
                    Sync Labs API (cloud)
                  </label>
                </div>
              </div>
            )}

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
              sublabel="Useful for debugging — keeps intermediate audio/video files after job completes."
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
