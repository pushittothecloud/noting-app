import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../modules/session/sessionStore'
import { HeatMap } from '../components/HeatMap'
import { getGuidedReactionSummary, getLowestSenseInsight } from '../modules/analytics/resultSelectors'
import { analyzeFreeSession } from '../modules/analytics/sessionAnalysis'
import { SENSES } from '../modules/session/types'
import styles from './Results.module.css'

export function Results() {
  const navigate = useNavigate()
  const { lastResult, clearResult } = useSessionStore()

  // if someone navigates here directly with no result, bounce home
  useEffect(() => {
    if (!lastResult) navigate('/', { replace: true })
  }, [lastResult, navigate])

  if (!lastResult) return null

  const { stats } = lastResult
  const durationSec = (stats.durationMs / 1000).toFixed(1)
  const isFreeMode = lastResult.config.mode === 'free'
  const guidedSummary = getGuidedReactionSummary(lastResult)
  const lowestSenseInsight = getLowestSenseInsight(lastResult)
  const freeAnalysis = isFreeMode ? analyzeFreeSession(lastResult) : null

  return (
    <main className={styles.page}>
      <h2 className={styles.heading}>{isFreeMode ? 'Free Noting Complete' : 'Session Complete'}</h2>

      <div className={styles.statRow}>
        <Stat label="Duration" value={`${durationSec}s`} />
        <Stat label="Total Notings" value={stats.totalNotings} />
        <Stat label="Noticings / sec" value={stats.notingsPerSecond.toFixed(2)} />
      </div>

      <div className={styles.statRow}>
        <Stat label="Fastest Noting" value={stats.fastestNotingMs ? `${stats.fastestNotingMs}ms` : '—'} />
        <Stat label="Slowest Noting" value={stats.slowestNotingMs ? `${stats.slowestNotingMs}ms` : '—'} />
        <Stat label="Fastest Streak" value={stats.fastestStreak || '—'} />
      </div>

      <div className={styles.statRow}>
        <Stat label="Inactive Periods" value={stats.inactivityPeriods.length} />
        <Stat label="Longest Quiet Spell" value={stats.longestInactivityMs ? `${Math.round(stats.longestInactivityMs / 1000)}s` : '—'} />
      </div>

      {guidedSummary && (
        <div className={styles.statRow}>
          <Stat label="Avg Reaction" value={guidedSummary.averageMs ? `${Math.round(guidedSummary.averageMs)}ms` : '—'} />
          <Stat label="Guided Accuracy" value={guidedSummary.accuracyPct != null ? `${Math.round(guidedSummary.accuracyPct)}%` : '—'} />
        </div>
      )}

      {lastResult.config.mode === 'targeted' && (
        <div className={styles.senseBreakdown}>
          <h3 className={styles.analysisHeading}>Response time per sense</h3>
          <div className={styles.statRow}>
            {(['see', 'hear', 'feel', 'taste'] as const).map((sense) => {
              const ms = stats.averageResponseMsBySense[sense]
              return (
                <Stat
                  key={sense}
                  label={SENSES[sense].label}
                  value={ms != null ? `${Math.round(ms)}ms` : '—'}
                />
              )
            })}
          </div>
        </div>
      )}

      {lowestSenseInsight && (
        <p className={styles.insight}>
          {lowestSenseInsight}
        </p>
      )}

      {isFreeMode && (
        <p className={styles.insight}>
          This session is your baseline: pace, streaks, inactivity, and sense balance all come from spontaneous noting only.
        </p>
      )}

      {freeAnalysis && (
        <div className={styles.analysisPanel}>
          <h3 className={styles.analysisHeading}>What to train next</h3>
          {freeAnalysis.weakSenses.length > 0 ? (
            <>
              <p className={styles.analysisInsight}>
                Your weaker senses this session:
                {' '}
                <span className={styles.weakSenses}>
                  {freeAnalysis.weakSenses.map((s) => SENSES[s].label).join(', ')}
                </span>
              </p>
              <p className={styles.analysisSubtext}>
                The next session will prompt these senses more often and track how fast you respond to each.
              </p>
              <button
                className={styles.trainBtn}
                onClick={() => {
                  clearResult()
                  navigate('/session', {
                    state: {
                      mode: 'targeted',
                      focusedSenses: freeAnalysis.weakSenses,
                      senseWeights: freeAnalysis.senseWeights,
                    },
                  })
                }}
              >
                Train Weak Points
              </button>
            </>
          ) : (
            <p className={styles.analysisInsight}>
              Your sense distribution is well balanced — great work!
            </p>
          )}
        </div>
      )}

      <HeatMap stats={stats} />

      <div className={styles.actions}>
        <button
          className={styles.btn}
          onClick={() => {
            clearResult()
            navigate('/session')
          }}
        >
          New Session
        </button>
        <button
          className={styles.btn}
          onClick={() => {
            clearResult()
            navigate('/progress')
          }}
        >
          View Progress
        </button>
      </div>
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
