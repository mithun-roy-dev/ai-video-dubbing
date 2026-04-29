import { useAppStore } from '../store/useAppStore'
import { estimateCost, formatCostRange } from '../lib/cost'

export function CostBadge() {
  const { mode, settings } = useAppStore()

  // We don't know duration yet on home screen; show generic range
  const estimate = estimateCost(300, mode, settings.lipSyncEnabled) // assume 5-min base

  return (
    <span className="cost-badge">
      Est. ~{formatCostRange(estimate)} / 5 min
    </span>
  )
}
