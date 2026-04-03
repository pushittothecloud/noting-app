import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSessionStore } from '../modules/session/sessionStore'
import { useSettingsStore } from '../modules/settings/settingsStore'
import { useFeedbackStore } from '../modules/feedback/feedbackStore'
import { useSessionFeedback } from '../modules/feedback/useSessionFeedback'
import { useKeyInput } from '../modules/input/useKeyInput'
import { SenseIndicator } from '../components/SenseIndicator'
import { SenseFeedbackOverlay } from '../components/SenseFeedbackOverlay'
import { SENSES, type SenseKey, type TrainingMode } from '../modules/session/types'
import { isGuidedMode } from '../modules/training/modes'
import styles from './Session.module.css'

export function Session() {
  const navigate = useNavigate()
  const location = useLocation()
  const { settings } = useSettingsStore()
  const {
    active,
    status,
    startSession,
    pauseSession,
    resumeSession,
    getElapsedMs,
    queueNextPrompt,
    recordNoting,
    endSession,
  } = useSessionStore()
  const { activeSense, feedbackToken, flash } = useFeedbackStore()

  const [elapsed, setElapsed] = useState(0)
  const [heldSense, setHeldSense] = useState<SenseKey | null>(null)
  const [focusedObject, setFocusedObject] = useState<SenseKey | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spokenPromptIdRef = useRef<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const isFreeModRef = useRef(false)
  const freeSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // auto-start on mount
  useEffect(() => {
    const focusConfig = location.state as {
      mode?: TrainingMode
      focusedSenses?: SenseKey[]
      focusedSense?: SenseKey
      durationSec?: number | null
      senseWeights?: Partial<Record<SenseKey, number>>
    } | null

    const mode = focusConfig?.mode ?? settings.defaultMode
    const initialFocusedSense = focusConfig?.focusedSense ?? (mode === 'focused' ? 'see' : null)
    setFocusedObject(initialFocusedSense)

    startSession({
      mode,
      durationSec: focusConfig?.durationSec ?? settings.defaultDurationSec,
      guidedMode: isGuidedMode(mode),
      feedbackEnabled: settings.feedbackEnabled,
      innerOuterEnabled: settings.innerOuterEnabled,
      backgroundAudio: settings.backgroundAudio,
      backgroundVisuals: settings.backgroundVisuals,
      focusedSenses: focusConfig?.focusedSenses,
      focusedSense: initialFocusedSense ?? undefined,
      senseWeights: focusConfig?.senseWeights,
    })

    intervalRef.current = setInterval(() => setElapsed(getElapsedMs()), 100)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!active?.config.durationSec) return

    if (elapsed >= active.config.durationSec * 1000) {
      handleEnd()
    }
  }, [active?.config.durationSec, elapsed])

  useKeyInput({
    enabled: !!active && status === 'running',
    onTap(sense) {
      if (isFocusedMode) return

      // Speak label immediately in free mode — directly in the event callback,
      // not via useEffect, so there is zero render-cycle latency.
      if (isFreeModRef.current && 'speechSynthesis' in window) {
        const synth = window.speechSynthesis
        synth.cancel()

        if (freeSpeechTimerRef.current) {
          clearTimeout(freeSpeechTimerRef.current)
        }

        // Queue on next tick so cancel fully flushes in engines that otherwise drop rapid restart.
        freeSpeechTimerRef.current = setTimeout(() => {
          const u = new SpeechSynthesisUtterance(SENSES[sense].label)
          u.rate = 1.4
          u.pitch = 0.9
          u.volume = 0.7
          synth.speak(u)
        }, 0)
      }

      const isFocusPrompt = isGuidedShiftMode && currentPrompt?.kind === 'attention'

      const isPromptCorrect = isGuided && currentPrompt
        ? (isFocusPrompt ? false : sense === currentPrompt.targetSense)
        : null

      recordNoting({
        sense,
        inputType: 'tap',
        attentionType: 'open',
        source: isGuided ? 'prompted' : 'free',
        prompt: isPromptCorrect != null ? { isCorrect: isPromptCorrect } : undefined,
      })

      if (isPromptCorrect != null) {
        playPromptResultTone(isPromptCorrect, audioContextRef, settings.audioFeedbackEnabled)
      }

      if (shouldFlashSenseFeedback) flash(sense)
    },
    onHoldStart(sense) {
      const acceptsGuidedHold = isGuidedShiftMode && currentPrompt?.kind === 'attention'
      if (isGuided && !acceptsGuidedHold) return
      if (isFocusedMode) {
        const targetSense = focusedObject ?? sense
        if (!focusedObject) setFocusedObject(sense)
        if (sense !== targetSense) return
      }
      if (acceptsGuidedHold && sense !== currentPrompt?.targetSense) return
      setHeldSense(sense)
      if (shouldFlashSenseFeedback) flash(sense)
    },
    onHoldEnd(sense, durationMs) {
      const acceptsGuidedHold = isGuidedShiftMode && currentPrompt?.kind === 'attention'
      if (isGuided && !acceptsGuidedHold) return
      if (isFocusedMode) {
        const targetSense = focusedObject ?? sense
        if (sense !== targetSense) return
      }
      setHeldSense(null)

      const isPromptCorrect = acceptsGuidedHold
        ? sense === currentPrompt?.targetSense
        : null

      recordNoting({
        sense,
        inputType: 'hold',
        attentionType: 'focused',
        holdDurationMs: durationMs,
        source: acceptsGuidedHold ? 'prompted' : 'free',
        prompt: isPromptCorrect != null ? { isCorrect: isPromptCorrect } : undefined,
      })

      if (isPromptCorrect != null) {
        playPromptResultTone(isPromptCorrect, audioContextRef, settings.audioFeedbackEnabled)
      }
    },
    onSpacebar() {
      if (status === 'running') {
        pauseSession()
      } else if (status === 'paused') {
        resumeSession()
      }
    },
    holdPreventsTap: false,
  })

  function handleEnd() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    playSessionCompleteTone(audioContextRef)
    const result = endSession()
    if (result) {
      navigate('/results')
    }
  }

  const totalNotings = active?.notings.length ?? 0
  const elapsedSec = elapsed / 1000
  const nps = elapsedSec > 0 ? (totalNotings / elapsedSec).toFixed(2) : '0.00'
  const isPaused = status === 'paused'
  const mode = active?.config.mode ?? settings.defaultMode
  const isFreeMode = mode === 'free'
  isFreeModRef.current = isFreeMode
  const isFocusedMode = mode === 'focused'
  const isGuidedShiftMode = mode === 'guided_shift'
  const isGuided = isGuidedMode(mode)
  const currentPrompt = active?.currentPrompt ?? null
  const shouldFlashSenseFeedback =
    settings.feedbackEnabled || (!isGuided && (settings.audioFeedbackEnabled || settings.spokenFeedbackEnabled))
  const focusedHolds = (active?.notings ?? []).filter((n) => {
    if (n.inputType !== 'hold' || n.attentionType !== 'focused') return false
    if (!isFocusedMode) return true
    return focusedObject ? n.sense === focusedObject : true
  })
  const focusedHoldCount = focusedHolds.length
  const focusedTotalMs = focusedHolds.reduce((sum, n) => sum + (n.holdDurationMs ?? 0), 0)

  useEffect(() => {
    if (active && isGuided && !active.currentPrompt) {
      queueNextPrompt()
    }
  }, [active, isGuided, queueNextPrompt])

  useEffect(() => {
    if (!isGuided || !currentPrompt || isPaused) return
    if (!settings.spokenFeedbackEnabled || !('speechSynthesis' in window)) return
    if (spokenPromptIdRef.current === currentPrompt.id) return

    spokenPromptIdRef.current = currentPrompt.id
    const utterance = new SpeechSynthesisUtterance(currentPrompt.cue)
    utterance.rate = 0.92
    utterance.pitch = 0.95
    utterance.volume = 0.65
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }, [isGuided, currentPrompt, isPaused, settings.spokenFeedbackEnabled])

  useEffect(() => {
    return () => {
      if (freeSpeechTimerRef.current) {
        clearTimeout(freeSpeechTimerRef.current)
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  useSessionFeedback({
    activeSense,
    feedbackToken,
    audioEnabled: isFreeMode && settings.audioFeedbackEnabled,
    spokenEnabled: false,
  })

  return (
    <main className={styles.page}>
      <SenseFeedbackOverlay
        sense={activeSense}
        visible={settings.feedbackEnabled}
        styleMode={settings.visualFeedbackStyle}
      />
      <div className={styles.modeLabel}>{
        isFreeMode
          ? 'Free Noting'
          : mode === 'targeted'
            ? 'Targeted Training'
            : mode === 'focused'
              ? 'Focused Attention'
              : mode === 'guided_shift'
                ? 'Guided Shift'
                : isGuided
                  ? 'Guided Mode'
                  : mode.replace('_', ' ')
      }</div>
      <div className={styles.timer}>{formatTime(elapsedSec)}</div>
      <div className={styles.nps}>
        <span className={styles.npsValue}>{nps}</span>
        <span className={styles.npsLabel}>noticings / sec</span>
      </div>

      {isFreeMode && !isPaused && (
        <p className={styles.guidance}>Notice what arises and label it with a single key press.</p>
      )}

      {isFocusedMode && !isPaused && (
        <section className={styles.focusPanel}>
          <h3 className={styles.focusHeading}>Choose Meditation Object</h3>
          <div className={styles.objectGrid}>
            {(['see', 'hear', 'feel', 'taste'] as const).map((sense) => (
              <button
                key={sense}
                className={`${styles.objectBtn} ${focusedObject === sense ? styles.objectBtnActive : ''}`}
                onClick={() => setFocusedObject(sense)}
              >
                {SENSES[sense].emoji} {SENSES[sense].label}
              </button>
            ))}
          </div>
          <p className={styles.focusGuide}>
            Hold your selected key while attention is steady. Release when focus breaks, then press again when refocused.
          </p>
          <div className={styles.focusStatusRow}>
            <span className={styles.focusStatusLabel}>Now</span>
            <span className={styles.focusStatusValue}>
              {!focusedObject
                ? 'Hold any object key to begin'
                : heldSense
                  ? `Holding ${SENSES[heldSense].label}`
                  : `Ready on ${SENSES[focusedObject].label}`}
            </span>
          </div>
          {!focusedObject && <p className={styles.focusWarning}>You can select an object above, or just hold one key and it will be set automatically.</p>}
          <div className={styles.focusStats}>
            <span>Focused holds: {focusedHoldCount}</span>
            <span>Focused time: {(focusedTotalMs / 1000).toFixed(1)}s</span>
          </div>
        </section>
      )}

      {isGuided && currentPrompt && !isPaused && (
        <div className={styles.promptCard}>
          <span className={styles.promptLabel}>Prompt</span>
          <span className={styles.promptCue}>{currentPrompt.cue}</span>
          <span className={styles.promptHint}>
            {currentPrompt.kind === 'attention'
              ? 'Hold the matching key while focused. Release when focus drifts.'
              : 'Press the matching direction as soon as it becomes clear.'}
          </span>
        </div>
      )}

      <div className={styles.controls}>
        <button className={styles.controlBtn} onClick={() => (isPaused ? resumeSession() : pauseSession())}>
          {isPaused ? 'Resume' : 'Pause'}
        </button>
        {(!isFreeMode || isFocusedMode) && <span className={styles.controlHint}>Space toggles pause</span>}
      </div>

      {isPaused && <div className={styles.pauseBanner}>Paused</div>}

      {/* sense grid (WASD / arrow directions) */}
      <div className={styles.senseGrid}>
        {/* top = see */}
        <div className={styles.top}>
          <SenseIndicator sense="see" active={activeSense === 'see' || heldSense === 'see'} size="lg" />
        </div>
        {/* middle row: feel | empty | hear */}
        <div className={styles.middle}>
          <SenseIndicator sense="feel" active={activeSense === 'feel' || heldSense === 'feel'} size="lg" />
          <div className={styles.notingCount}>{totalNotings}</div>
          <SenseIndicator sense="hear" active={activeSense === 'hear' || heldSense === 'hear'} size="lg" />
        </div>
        {/* bottom = taste */}
        <div className={styles.bottom}>
          <SenseIndicator sense="taste" active={activeSense === 'taste' || heldSense === 'taste'} size="lg" />
        </div>
      </div>

      <button className={styles.endBtn} onClick={handleEnd}>
        End Session
      </button>
    </main>
  )
}

function formatTime(totalSec: number) {
  const wholeSeconds = Math.floor(totalSec)
  const m = Math.floor(wholeSeconds / 60).toString().padStart(2, '0')
  const s = (wholeSeconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function playPromptResultTone(
  isCorrect: boolean,
  audioContextRef: { current: AudioContext | null },
  enabled: boolean,
) {
  if (!enabled) return

  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return
  if (!audioContextRef.current) {
    audioContextRef.current = new AudioCtor()
  }

  const context = audioContextRef.current
  const now = context.currentTime
  const frequencies = isCorrect ? [660, 880] : [220, 170]

  frequencies.forEach((frequency, index) => {
    const start = now + index * 0.09
    const osc = context.createOscillator()
    const gain = context.createGain()

    osc.type = isCorrect ? 'sine' : 'triangle'
    osc.frequency.value = frequency

    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.08)

    osc.connect(gain)
    gain.connect(context.destination)
    osc.start(start)
    osc.stop(start + 0.09)
  })
}

function playSessionCompleteTone(audioContextRef: { current: AudioContext | null }) {
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return
  if (!audioContextRef.current) {
    audioContextRef.current = new AudioCtor()
  }

  const context = audioContextRef.current
  const now = context.currentTime
  const frequencies = [523.25, 659.25, 783.99]

  frequencies.forEach((frequency, index) => {
    const start = now + index * 0.11
    const osc = context.createOscillator()
    const gain = context.createGain()

    osc.type = 'sine'
    osc.frequency.value = frequency

    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1)

    osc.connect(gain)
    gain.connect(context.destination)
    osc.start(start)
    osc.stop(start + 0.11)
  })
}
