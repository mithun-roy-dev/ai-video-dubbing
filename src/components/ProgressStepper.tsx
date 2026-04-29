import { useJobStore } from '../store/useJobStore'
import { useAppStore } from '../store/useAppStore'

const BASE_STEPS = [
  { num: 1, name: 'Download / Load video' },
  { num: 2, name: 'Extract audio' },
  { num: 3, name: 'Transcribe' },
  { num: 4, name: 'Translate' },
  { num: 5, name: 'Text-to-Speech' },
  { num: 6, name: 'Align timing' },
  { num: 8, name: 'Compose final video' },
]

const LIP_SYNC_STEP = { num: 7, name: 'Lip Sync' }

export function ProgressStepper() {
  const { currentStep, pct, status } = useJobStore()
  const { settings } = useAppStore()

  const steps = settings.lipSyncEnabled
    ? [
        ...BASE_STEPS.slice(0, 6),
        LIP_SYNC_STEP,
        BASE_STEPS[6],
      ]
    : BASE_STEPS

  return (
    <div className="progress-stepper">
      {steps.map((step) => {
        const isDone = step.num < currentStep || (step.num === currentStep && status === 'done')
        const isActive = step.num === currentStep && status === 'running'
        const isPending = step.num > currentStep

        return (
          <div
            key={step.num}
            className={`step-item ${isDone ? 'step--done' : ''} ${isActive ? 'step--active' : ''} ${isPending ? 'step--pending' : ''}`}
          >
            <div className="step-indicator">
              {isDone ? (
                <span className="step-check">✓</span>
              ) : isActive ? (
                <span className="step-spinner">⟳</span>
              ) : (
                <span className="step-num">{step.num}</span>
              )}
            </div>
            <div className="step-info">
              <span className="step-name">{step.name}</span>
              {isActive && (
                <div className="step-progress-bar">
                  <div className="step-progress-fill" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
