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
  const isReactionMode = lastResult.config.mode === 'reaction'
  const isGranularityMode = lastResult.config.mode === 'guided_granularity'
  const isSenseShiftMode = lastResult.config.mode === 'sense_shift'
  const isFreeMode = lastResult.config.mode === 'free'
  const guidedSummary = getGuidedReactionSummary(lastResult)
  const lowestSenseInsight = getLowestSenseInsight(lastResult)
  const freeAnalysis = isFreeMode ? analyzeFreeSession(lastResult) : null
  const granularityMetrics = isGranularityMode ? getGranularityMetrics(lastResult.notings) : null
  const senseShiftMetrics = isSenseShiftMode ? getSenseShiftMetrics(lastResult.notings) : null

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

      {granularityMetrics && (
        <div className={styles.statRow}>
          <Stat label="Notes / Object" value={granularityMetrics.notesPerObject.toFixed(2)} />
          <Stat label="Burst Density" value={`${granularityMetrics.burstDensity.toFixed(2)}/s`} />
        </div>
      )}

      {senseShiftMetrics && (
        <div className={styles.statRow}>
          <Stat label="Switch Reaction" value={senseShiftMetrics.switchReactionMs != null ? `${Math.round(senseShiftMetrics.switchReactionMs)}ms` : '—'} />
          <Stat label="Stuck Error Rate" value={`${Math.round(senseShiftMetrics.stuckErrorRatePct)}%`} />
        </div>
      )}

      {lastResult.config.mode === 'targeted' && (
        <div className={styles.senseBreakdown}>
          <h3 className={styles.analysisHeading}>Response time per sense</h3>
          <div className={styles.statRow}>
            {(['see', 'hear', 'feel'] as const).map((sense) => {
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

      {isGranularityMode && (
        <p className={styles.insight}>
          Do not move to a new object. Find more inside the same one.
        </p>
      )}

      {isSenseShiftMode && (
        <p className={styles.insight}>
          Drop the old sense instantly. Do not drag it with you.
        </p>
      )}

      {isReactionMode && (
        <p className={styles.insight}>
          Calibration mode: train clean stimulus-to-response speed before deeper noting work.
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

function getGranularityMetrics(notings: Array<{ timestamp: number; prompt?: { targetSense?: string } }>) {
  const prompted = notings.filter((n) => n.prompt?.targetSense)
  if (prompted.length === 0) {
    return { notesPerObject: 0, burstDensity: 0 }
  }

  let objectRuns = 1
  let burstCount = 1
  for (let i = 1; i < prompted.length; i++) {
    const prev = prompted[i - 1]
    const cur = prompted[i]
    if (cur.prompt?.targetSense !== prev.prompt?.targetSense) {
      objectRuns += 1
    }
    if (cur.timestamp - prev.timestamp <= 1200) {
      burstCount += 1
    }
  }

  const notesPerObject = prompted.length / objectRuns
  const burstWindowSec = prompted.length > 1 ? Math.max((prompted[prompted.length - 1].timestamp - prompted[0].timestamp) / 1000, 1) : 1
  const burstDensity = burstCount / burstWindowSec

  return { notesPerObject, burstDensity }
}

function getSenseShiftMetrics(
  notings: Array<{
    sense: string
    prompt?: { kind?: string; fromSense?: string; responseTimeMs?: number; isCorrect?: boolean }
  }>
) {
  const transitions = notings.filter((n) => n.prompt?.kind === 'transition')
  if (transitions.length === 0) {
    return { switchReactionMs: null, stuckErrorRatePct: 0 }
  }

  const responseTimes = transitions
    .map((n) => n.prompt?.responseTimeMs)
    .filter((value): value is number => value != null)
  const switchReactionMs = responseTimes.length
    ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length
    : null

  const stuckErrors = transitions.filter((n) => n.prompt?.isCorrect === false && n.prompt?.fromSense === n.sense).length
  const stuckErrorRatePct = (stuckErrors / transitions.length) * 100

  return { switchReactionMs, stuckErrorRatePct }
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}
