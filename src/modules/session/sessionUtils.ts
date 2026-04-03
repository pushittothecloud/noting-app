import type { InactivityPeriod, NotingEvent, SenseKey, SessionStats } from './types'

const STREAK_THRESHOLD_MS = 1500
const INACTIVITY_THRESHOLD_MS = 5000

export function computeStats(notings: NotingEvent[], durationMs: number): SessionStats {
  const total = notings.length
  const durationSec = durationMs / 1000

  const countBySense: Record<SenseKey, number> = {
    see: 0,
    hear: 0,
    feel: 0,
    taste: 0,
  }

  let fastestNotingMs = Infinity
  let slowestNotingMs = 0
  let fastestStreak = 0
  let currentStreak = 0
  const inactivityPeriods: InactivityPeriod[] = []

  const guidedNotings = notings.filter((n) => n.source === 'prompted')
  const guidedCorrect = guidedNotings.filter((n) => n.prompt?.isCorrect === true).length
  const guidedAccuracyPct =
    guidedNotings.length > 0 ? (guidedCorrect / guidedNotings.length) * 100 : null
  const guidedResponseTimes = guidedNotings
    .map((n) => n.prompt?.responseTimeMs)
    .filter((value): value is number => value != null)
  const guidedAverageResponseMs =
    guidedResponseTimes.length > 0
      ? guidedResponseTimes.reduce((sum, value) => sum + value, 0) / guidedResponseTimes.length
      : null

  const orderedNotings = [...notings].sort((a, b) => a.timestamp - b.timestamp)

  if (orderedNotings.length > 0) {
    currentStreak = 1
    fastestStreak = 1

    const initialGap = orderedNotings[0].timestamp
    if (initialGap >= INACTIVITY_THRESHOLD_MS) {
      inactivityPeriods.push({
        startMs: 0,
        endMs: orderedNotings[0].timestamp,
        durationMs: initialGap,
      })
    }
  }

  for (const n of orderedNotings) {
    countBySense[n.sense]++

    const timingMs = n.prompt?.responseTimeMs

    if (timingMs != null) {
      if (timingMs < fastestNotingMs) fastestNotingMs = timingMs
      if (timingMs > slowestNotingMs) slowestNotingMs = timingMs
    }
  }

  for (let index = 1; index < orderedNotings.length; index++) {
    const previous = orderedNotings[index - 1]
    const current = orderedNotings[index]
    const gapMs = current.timestamp - previous.timestamp

    if (gapMs < fastestNotingMs) fastestNotingMs = gapMs
    if (gapMs > slowestNotingMs) slowestNotingMs = gapMs

    if (gapMs <= STREAK_THRESHOLD_MS) {
      currentStreak += 1
      if (currentStreak > fastestStreak) fastestStreak = currentStreak
    } else {
      currentStreak = 1
    }

    if (gapMs >= INACTIVITY_THRESHOLD_MS) {
      inactivityPeriods.push({
        startMs: previous.timestamp,
        endMs: current.timestamp,
        durationMs: gapMs,
      })
    }
  }

  if (orderedNotings.length === 0 && durationMs >= INACTIVITY_THRESHOLD_MS) {
    inactivityPeriods.push({
      startMs: 0,
      endMs: durationMs,
      durationMs,
    })
  } else if (orderedNotings.length > 0) {
    const trailingGap = durationMs - orderedNotings[orderedNotings.length - 1].timestamp
    if (trailingGap >= INACTIVITY_THRESHOLD_MS) {
      inactivityPeriods.push({
        startMs: orderedNotings[orderedNotings.length - 1].timestamp,
        endMs: durationMs,
        durationMs: trailingGap,
      })
    }
  }

  const longestInactivityMs = inactivityPeriods.reduce(
    (max, period) => Math.max(max, period.durationMs),
    0
  )

  // Per-sense average response time (only meaningful for guided/targeted notings)
  const responseTimesBySense: Record<SenseKey, number[]> = { see: [], hear: [], feel: [], taste: [] }
  for (const n of notings) {
    if (n.source === 'prompted' && n.prompt?.responseTimeMs != null && n.prompt.targetSense) {
      responseTimesBySense[n.prompt.targetSense].push(n.prompt.responseTimeMs)
    }
  }
  const avgArr = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null
  const averageResponseMsBySense: Record<SenseKey, number | null> = {
    see:   avgArr(responseTimesBySense.see),
    hear:  avgArr(responseTimesBySense.hear),
    feel:  avgArr(responseTimesBySense.feel),
    taste: avgArr(responseTimesBySense.taste),
  }

  return {
    totalNotings: total,
    notingsPerSecond: durationSec > 0 ? total / durationSec : 0,
    fastestNotingMs: fastestNotingMs === Infinity ? 0 : fastestNotingMs,
    slowestNotingMs,
    fastestStreak,
    lowestSense: null, // resolved in store after this call
    countBySense,
    guidedAccuracyPct,
    guidedAverageResponseMs,
    averageResponseMsBySense,
    inactivityPeriods,
    longestInactivityMs,
    durationMs,
  }
}
