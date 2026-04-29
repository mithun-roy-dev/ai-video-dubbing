import { useState } from 'react'
import {
  useAppStore,
  STEP_PROVIDERS,
  STEP_DEFAULT_MODELS,
  PROVIDER_DEFS,
  type ApiProviders,
  type StepProviderConfig,
} from '../store/useAppStore'

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEP_META: Record<
  keyof ApiProviders,
  { number: number; title: string; description: string; icon: string; optional?: boolean }
> = {
  transcription: {
    number: 3,
    icon: '🎙️',
    title: 'Transcription API',
    description: 'Converts speech in the original video to timed text segments (via Whisper).',
  },
  translation: {
    number: 4,
    icon: '🌐',
    title: 'Translation API',
    description: 'Sends transcript segments to an LLM for translation while preserving timing boundaries.',
  },
  tts: {
    number: 5,
    icon: '🔊',
    title: 'Text-to-Speech API',
    description: 'Synthesizes each translated segment into an audio clip.',
  },
  lipsync: {
    number: 7,
    icon: '👄',
    title: 'Lip Sync API',
    description: 'Animates speaker mouth movements to match the dubbed audio.',
    optional: true,
  },
}

const STEP_ORDER: (keyof ApiProviders)[] = ['transcription', 'translation', 'tts', 'lipsync']

// ─── Single step card ─────────────────────────────────────────────────────────

interface StepCardProps {
  stepKey: keyof ApiProviders
  config: StepProviderConfig
  lipSyncEnabled: boolean
}

function StepCard({ stepKey, config, lipSyncEnabled }: StepCardProps) {
  const { updateStepProvider } = useAppStore()
  const [open, setOpen] = useState(true)
  const meta = STEP_META[stepKey]
  const providerIds = STEP_PROVIDERS[stepKey]
  const providerDef = PROVIDER_DEFS[config.provider]
  const models = STEP_DEFAULT_MODELS[stepKey]?.[config.provider] ?? []
  const isDisabled = stepKey === 'lipsync' && !lipSyncEnabled

  function handleProviderChange(newProvider: string) {
    const def = PROVIDER_DEFS[newProvider]
    const newModels = STEP_DEFAULT_MODELS[stepKey]?.[newProvider] ?? []
    updateStepProvider(stepKey, {
      provider: newProvider,
      apiPath: def?.defaultApiPath ?? '',
      model: newModels[0]?.id ?? '',
      // Keep apiKey if same provider category
    })
  }

  return (
    <div className={`provider-card ${isDisabled ? 'provider-card--disabled' : ''}`}>
      {/* Card header */}
      <button
        className="provider-card__header"
        onClick={() => setOpen((o) => !o)}
        type="button"
        aria-expanded={open}
      >
        <div className="provider-card__header-left">
          <span className="provider-card__step-badge">Step {meta.number}</span>
          <span className="provider-card__icon">{meta.icon}</span>
          <div>
            <div className="provider-card__title">{meta.title}</div>
            {meta.optional && (
              <span className="provider-card__optional-badge">
                {isDisabled ? 'Disabled in Pipeline Options' : 'Optional'}
              </span>
            )}
          </div>
        </div>
        <div className="provider-card__header-right">
          <span className="provider-card__current-provider">{providerDef?.label ?? config.provider}</span>
          <span className={`provider-card__chevron ${open ? 'provider-card__chevron--open' : ''}`}>›</span>
        </div>
      </button>

      {/* Card body */}
      {open && (
        <div className="provider-card__body">
          <p className="provider-card__desc">{meta.description}</p>

          <div className="provider-fields">
            {/* Provider selector */}
            <div className="provider-field">
              <label className="provider-field__label">
                {meta.title.replace(' API', '')} API Provider
              </label>
              <div className="provider-pills">
                {providerIds.map((pid) => (
                  <button
                    key={pid}
                    type="button"
                    className={`provider-pill ${config.provider === pid ? 'provider-pill--active' : ''}`}
                    onClick={() => handleProviderChange(pid)}
                    disabled={isDisabled}
                  >
                    {PROVIDER_DEFS[pid]?.label ?? pid}
                  </button>
                ))}
              </div>
            </div>

            {/* Model selector */}
            {models.length > 0 && (
              <div className="provider-field">
                <label className="provider-field__label" htmlFor={`${stepKey}-model`}>
                  API Model
                </label>
                <select
                  id={`${stepKey}-model`}
                  className="provider-select"
                  value={config.model}
                  onChange={(e) => updateStepProvider(stepKey, { model: e.target.value })}
                  disabled={isDisabled}
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* API Path */}
            {config.provider !== 'wav2lip' && (
              <div className="provider-field">
                <label className="provider-field__label" htmlFor={`${stepKey}-api-path`}>
                  API Base URL
                </label>
                <input
                  id={`${stepKey}-api-path`}
                  type="url"
                  className="provider-input"
                  value={config.apiPath}
                  placeholder="https://api.example.com/v1"
                  onChange={(e) => updateStepProvider(stepKey, { apiPath: e.target.value })}
                  disabled={isDisabled}
                />
              </div>
            )}

            {/* API Key */}
            {providerDef?.apiKeyRequired && (
              <div className="provider-field">
                <div className="provider-field__label-row">
                  <label className="provider-field__label" htmlFor={`${stepKey}-api-key`}>
                    API Key
                    <span className="required-star">*</span>
                  </label>
                  {providerDef.apiKeyHint && (
                    <a
                      className="provider-field__hint-link"
                      href={providerDef.apiKeyHint}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Get key ↗
                    </a>
                  )}
                </div>
                <input
                  id={`${stepKey}-api-key`}
                  type="password"
                  className={`provider-input ${!config.apiKey && !isDisabled ? 'provider-input--missing' : ''}`}
                  value={config.apiKey}
                  placeholder={providerDef.apiKeyPlaceholder ?? 'Paste API key here...'}
                  onChange={(e) => updateStepProvider(stepKey, { apiKey: e.target.value })}
                  autoComplete="off"
                  disabled={isDisabled}
                />
                {!config.apiKey && !isDisabled && (
                  <p className="provider-field__error">API key required for this provider.</p>
                )}
              </div>
            )}

            {/* Wav2Lip local note */}
            {config.provider === 'wav2lip' && (
              <div className="provider-local-note">
                <span>🖥️</span>
                <p>
                  Wav2Lip runs locally on your machine — no API key needed.
                  The model file (<code>wav2lip.pth</code>) will be downloaded on first use (~360 MB).
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main section ─────────────────────────────────────────────────────────────

export function ApiProviderSection() {
  const { apiProviders, settings } = useAppStore()

  return (
    <section className="settings-section">
      <h3 className="settings-section__title">🔌 API Providers</h3>
      <p className="settings-section__subtitle">
        Configure the AI provider, model, and API credentials for each pipeline step independently.
        Settings are saved locally on your device.
      </p>

      <div className="provider-cards-list">
        {STEP_ORDER.map((key) => (
          <StepCard
            key={key}
            stepKey={key}
            config={apiProviders[key]}
            lipSyncEnabled={settings.lipSyncEnabled}
          />
        ))}
      </div>
    </section>
  )
}
