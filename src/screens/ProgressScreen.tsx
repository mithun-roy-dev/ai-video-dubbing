import { useJobStore } from '../store/useJobStore'
import { cancelJob } from '../lib/sidecar'
import { ProgressStepper } from '../components/ProgressStepper'
import { LogViewer } from '../components/LogViewer'

export function ProgressScreen() {
  const { currentStepName, pct, status } = useJobStore()

  async function handleCancel() {
    await cancelJob()
  }

  return (
    <main className="progress-screen">
      <div className="progress-screen__header">
        <h2 className="progress-screen__title">Dubbing in Progress</h2>
        <p className="progress-screen__subtitle">
          {status === 'running' ? (
            <>
              <span className="spinner-dot" />
              {currentStepName ? `${currentStepName}...` : 'Starting pipeline...'}
              {pct > 0 && <span className="pct-badge">{pct}%</span>}
            </>
          ) : status === 'cancelled' ? (
            'Job cancelled.'
          ) : (
            'Processing...'
          )}
        </p>
      </div>

      <div className="card progress-card">
        <ProgressStepper />
      </div>

      <div className="card">
        <LogViewer />
      </div>

      <div className="progress-screen__actions">
        <button
          id="cancel-job"
          className="cancel-btn"
          onClick={handleCancel}
          disabled={status !== 'running'}
          type="button"
        >
          ✕ Cancel Job
        </button>
      </div>
    </main>
  )
}
