/**
 * Cost estimation logic for Budget and Premium dubbing modes.
 * Based on per-service pricing from the technical spec.
 */

export interface CostEstimate {
  low: number
  high: number
}

/**
 * @param durationSec  - Video duration in seconds
 * @param mode         - 'budget' | 'premium'
 * @param lipSyncEnabled - Whether lip sync step is enabled
 */
export function estimateCost(
  durationSec: number,
  mode: 'budget' | 'premium',
  lipSyncEnabled: boolean
): CostEstimate {
  const mins = durationSec / 60
  const tokens = durationSec * 15 // ~15 tokens/sec of speech
  const chars = durationSec * 20 // ~20 chars/sec of speech

  // Whisper via OpenRouter — same for both modes
  const transcribeCost = mins * 0.006

  // Translation LLM
  const translateCost =
    mode === 'budget'
      ? (tokens / 1000) * 0.00015 // Gemini 2.0 Flash
      : (tokens / 1000) * 0.015 // GPT-4o

  // Text-to-Speech
  const ttsCost =
    mode === 'budget'
      ? 0 // KIE AI — plan-based pricing, estimated as 0
      : (chars / 1000) * 0.3 // ElevenLabs Multilingual v2

  // Lip Sync
  const lipSyncCost = !lipSyncEnabled
    ? 0
    : mode === 'budget'
      ? 0 // Wav2Lip is free (local compute)
      : durationSec * 0.03 // Sync Labs per second

  const total = transcribeCost + translateCost + ttsCost + lipSyncCost

  return {
    low: parseFloat((total * 0.8).toFixed(3)),
    high: parseFloat((total * 1.2).toFixed(3)),
  }
}

/**
 * Format a cost range for display
 */
export function formatCostRange(estimate: CostEstimate): string {
  if (estimate.high === 0) return 'Free'
  if (estimate.low === estimate.high) return `~$${estimate.low.toFixed(3)}`
  return `$${estimate.low.toFixed(3)} – $${estimate.high.toFixed(3)}`
}

/**
 * Rough time estimate in minutes
 */
export function estimateTimeMins(durationSec: number, mode: 'budget' | 'premium', lipSyncEnabled: boolean): number {
  const base = Math.ceil(durationSec / 60) * 0.8 // roughly 0.8x real time for API calls
  const lipFactor = lipSyncEnabled ? (mode === 'budget' ? 3 : 2) : 1
  return Math.max(1, Math.round(base * lipFactor))
}
