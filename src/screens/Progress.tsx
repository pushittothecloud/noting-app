import { useAnalyticsStore } from '../modules/analytics/analyticsStore'
import { HeatMap } from '../components/HeatMap'
import type { SenseKey } from '../modules/session/types'
import { SENSES } from '../modules/session/types'
import styles from './Progress.module.css'

export function Progress() {
  const { history, clearHistory } = useAnalyticsStore()

  if (history.length === 0) {
    return (
      <main className={styles.page}>
        <p className={styles.empty}>No sessions yet. Complete a session to see your progress.</p>
      </main>
    )
  }

  // aggregate all sessions
  const totalSessions = history.length
  const allNotings = history.flatMap((r) => r.notings)
  const totalNotings = allNotings.length
  const avgNps = history.reduce((s, r) => s + r.stats.notingsPerSecond, 0) / totalSessions
  const bestNps = Math.max(...history.map((r) => r.stats.notingsPerSecond))
  const bestStreak = Math.max(...history.map((r) => r.stats.fastestStreak))

  const aggregateCounts: Record<SenseKey, number> = { see: 0, hear: 0, feel: 0 }
  for (const r of history) {
    for (const k of Object.keys(r.stats.countBySense) as SenseKey[]) {
      aggregateCounts[k] += r.stats.countBySense[k]
    }
  }

  const aggregateStats = {
    totalNotings,
    notingsPerSecond: avgNps,
    fastestNotingMs: 0,
    slowestNotingMs: 0,
    fastestStreak: bestStreak,
    lowestSense: null,
    countBySense: aggregateCounts,
    guidedAccuracyPct: null,
    guidedAverageResponseMs: null,
    inactivityPeriods: [],
    longestInactivityMs: 0,
    durationMs: 0,
    averageResponseMsBySense: { see: null, hear: null, feel: null },
  }

  return (
    <main className={styles.page}>
      <h2 className={styles.heading}>Progress</h2>

      <div className={styles.statRow}>
        <Stat label="Sessions" value={totalSessions} />
        <Stat label="Total Notings" value={totalNotings} />
        <Stat label="Best NPS" value={bestNps.toFixed(2)} />
        <Stat label="Best Streak" value={bestStreak || '—'} />
      </div>

      <h3 className={styles.subheading}>All-time Sense Distribution</h3>
      <HeatMap stats={aggregateStats} />

      <div className={styles.recentList}>
        <h3 className={styles.subheading}>Recent Sessions</h3>
        {history.slice(0, 10).map((r) => (
          <div key={r.id} className={styles.recentRow}>
            <span className={styles.date}>{new Date(r.startedAt).toLocaleDateString()}</span>
            <span>{r.stats.totalNotings} notings</span>
            <span>{r.stats.notingsPerSecond.toFixed(2)} NPS</span>
            <span className={styles.mode}>{r.config.mode}</span>
          </div>
        ))}
      </div>

      <button
        className={styles.clearBtn}
        onClick={() => {
          if (confirm('Clear all history?')) clearHistory()
        }}
      >
        Clear History
      </button>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}
