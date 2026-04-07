import type { SessionResult, SenseKey } from '../session/types'

const SENSE_KEYS: SenseKey[] = ['see', 'hear', 'feel']

export interface FreeSessionAnalysis {
  weakSenses: SenseKey[]
  senseWeights: Record<SenseKey, number>
}

/**
 * Analyses a free-noting session and returns which senses are under-represented,
 * plus a weight map for use in a subsequent targeted-guided session.
 *
 * A sense is "weak" when its count is more than 20 % below the per-sense average.
 * The weight is the inverse of the sense's share, clamped to [1, 4], so weaker
 * senses get prompted proportionally more often.
 */
export function analyzeFreeSession(result: SessionResult): FreeSessionAnalysis {
  const { countBySense, totalNotings } = result.stats
  const averageCount = totalNotings / SENSE_KEYS.length

  const weakSenses = SENSE_KEYS.filter(
    (sense) => countBySense[sense] < averageCount * 0.8,
  )

  const senseWeights = {} as Record<SenseKey, number>
  for (const sense of SENSE_KEYS) {
    if (averageCount === 0) {
      senseWeights[sense] = 1
    } else {
      const ratio = countBySense[sense] / averageCount
      // ratio < 1 → used less → boost. Clamp between 1 and 4.
      senseWeights[sense] = Math.min(4, Math.max(1, Math.round(1 / Math.max(ratio, 0.25))))
    }
  }

  return { weakSenses, senseWeights }
}
