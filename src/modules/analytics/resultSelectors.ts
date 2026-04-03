import type { SessionResult } from '../session/types'

export function getGuidedReactionSummary(result: SessionResult) {
  if (result.config.mode !== 'guided') {
    return null
  }

  return {
    averageMs: result.stats.guidedAverageResponseMs,
    accuracyPct: result.stats.guidedAccuracyPct,
  }
}

export function getLowestSenseInsight(result: SessionResult) {
  if (!result.stats.lowestSense) {
    return null
  }

  return `Least noticed sense: ${result.stats.lowestSense}. Try spending more time there.`
}
