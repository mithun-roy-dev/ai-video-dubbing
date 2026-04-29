import { useAppStore } from '../store/useAppStore'
import { CostBadge } from './CostBadge'

export function ModeToggle() {
  const { mode, setMode } = useAppStore()

  return (
    <div className="mode-toggle-wrapper">
      <div className="mode-toggle-pill">
        <button
          id="mode-budget"
          onClick={() => setMode('budget')}
          className={`mode-btn ${mode === 'budget' ? 'mode-btn--budget active' : 'mode-btn--inactive'}`}
        >
          ⚡ Budget
        </button>
        <button
          id="mode-premium"
          onClick={() => setMode('premium')}
          className={`mode-btn ${mode === 'premium' ? 'mode-btn--premium active' : 'mode-btn--inactive'}`}
        >
          ✦ Premium
        </button>
      </div>
      <CostBadge />
    </div>
  )
}
