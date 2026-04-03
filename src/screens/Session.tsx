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

function getIntroLines(mode: TrainingMode): string[] {
  switch (mode) {
    case 'reaction':
      return ['React to the stimulus only.', 'Flash means See. Beep means Hear.']
    case 'guided':
      return ['Match each prompt quickly and accurately.', 'One prompt, one clean response.']
    case 'guided_granularity':
      return ['Stay on one sense and extract details.', 'Do not switch objects, find more inside it.']
    case 'sense_shift':
      return ['Follow transitions in exact order.', 'Drop the old sense instantly before switching.']
    case 'free':
      return ['Note what is present right now.', 'Keep labeling with simple, steady taps.']
    case 'targeted':
      return ['This drills your weaker senses.', 'Prioritize speed and accuracy under prompts.']
    case 'focused':
      return ['Choose one object and hold while stable.', 'Release on drift and re-hold on refocus.']
    case 'guided_shift':
      return ['This alternates noting and focused holding.', 'Adapt quickly as the prompt type changes.']
    case 'spatial_feel':
      return ['Keep it simple: press Feel for each prompt.', 'Track direction in body-space: up, down, left, right, forward, back.']
    case 'sustain':
      return ['Hold one sense steadily for longer periods.', 'Relax effort while keeping continuity.']
    case 'rapid_fire':
      return ['Maximize clean notes per second.', 'Stay precise while increasing tempo.']
    case 'inner_outer':
      return ['Notice inner and outer channels clearly.', 'Tag each without overthinking.']
    case 'flow':
      return ['Switch between focused and open awareness.', 'Keep transitions smooth and intentional.']
    default:
      return ['Settle in and follow the cues.', 'You can skip this intro anytime.']
  }
}

export function Session() {
  const navigate = useNavigate()
  const location = useLocation()
  const { settings } = useSettingsStore()
  const focusConfig = location.state as {
    mode?: TrainingMode
    focusedSenses?: SenseKey[]
    focusedSense?: SenseKey
    durationSec?: number | null
    senseWeights?: Partial<Record<SenseKey, number>>
  } | null
  const plannedMode = focusConfig?.mode ?? settings.defaultMode
  const plannedDurationSec = plannedMode === 'reaction'
    ? 30
    : (focusConfig?.durationSec ?? settings.defaultDurationSec)
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
  const [reactionFlashActive, setReactionFlashActive] = useState(false)
  const [senseShiftStep, setSenseShiftStep] = useState(0)
  const [showIntro, setShowIntro] = useState(true)
  const [sessionStarted, setSessionStarted] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spokenPromptIdRef = useRef<string | null>(null)
  const reactionStimulusIdRef = useRef<string | null>(null)
  const shiftPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const granularityPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reactionPromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const isFreeModRef = useRef(false)
  const freeSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reactionFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const introSpokenModeRef = useRef<TrainingMode | null>(null)

  function speakIntro() {
    if (!settings.spokenFeedbackEnabled || !('speechSynthesis' in window)) return

    const text = getIntroLines(plannedMode).join('. ')
    window.speechSynthesis.cancel()

    const speakOnce = () => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.96
      utterance.pitch = 0.96
      utterance.volume = 0.72
      window.speechSynthesis.speak(utterance)
    }

    // Some browsers silently drop the first call until voices are ready.
    speakOnce()
    setTimeout(() => {
      if (!window.speechSynthesis.speaking) {
        speakOnce()
      }
    }, 220)
  }

  function beginSession() {
    if (sessionStarted) return

    const initialFocusedSense = focusConfig?.focusedSense ?? (plannedMode === 'focused' ? 'see' : null)
    setFocusedObject(initialFocusedSense)
    setShowIntro(false)
    setSessionStarted(true)

    startSession({
      mode: plannedMode,
      durationSec: plannedDurationSec,
      guidedMode: isGuidedMode(plannedMode),
      feedbackEnabled: settings.feedbackEnabled,
      innerOuterEnabled: settings.innerOuterEnabled,
      backgroundAudio: settings.backgroundAudio,
      backgroundVisuals: settings.backgroundVisuals,
      focusedSenses: focusConfig?.focusedSenses,
      focusedSense: initialFocusedSense ?? undefined,
      senseWeights: focusConfig?.senseWeights,
    })

    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => setElapsed(getElapsedMs()), 100)
  }

  useEffect(() => {
    if (!showIntro || !settings.spokenFeedbackEnabled || !('speechSynthesis' in window)) return
    if (introSpokenModeRef.current === plannedMode) return

    introSpokenModeRef.current = plannedMode
    speakIntro()
  }, [showIntro, plannedMode, settings.spokenFeedbackEnabled])

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

      if (isSenseShiftMode && currentPrompt?.kind === 'transition') {
        const shiftPath = currentPrompt.transitionPath
          ?? [currentPrompt.fromSense, currentPrompt.targetSense].filter((item): item is SenseKey => Boolean(item))
        const expectedSense = shiftPath[senseShiftStep] ?? shiftPath[shiftPath.length - 1]
        const matched = sense === expectedSense

        if (!matched) {
          recordNoting({
            sense,
            inputType: 'tap',
            attentionType: 'open',
            source: 'prompted',
            prompt: { isCorrect: false },
          })
          playPromptResultTone(false, audioContextRef, settings.audioFeedbackEnabled)
          setSenseShiftStep(sense === shiftPath[0] ? 1 : 0)
          if (shouldFlashSenseFeedback) flash(sense)
          return
        }

        const nextStep = senseShiftStep + 1
        if (nextStep < shiftPath.length) {
          setSenseShiftStep(nextStep)
          if (shouldFlashSenseFeedback) flash(sense)
          return
        }

        recordNoting({
          sense,
          inputType: 'tap',
          attentionType: 'open',
          source: 'prompted',
          prompt: { isCorrect: true },
        })
        playPromptResultTone(true, audioContextRef, settings.audioFeedbackEnabled)
        setSenseShiftStep(0)
        if (shouldFlashSenseFeedback) flash(sense)
        return
      }

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
        if (!isReactionMode) {
          playPromptResultTone(isPromptCorrect, audioContextRef, settings.audioFeedbackEnabled)
        }
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
      if (isGuided && !acceptsGuidedHold) {
        if (isSenseShiftMode && currentPrompt?.kind === 'transition') {
          const shiftPath = currentPrompt.transitionPath
            ?? [currentPrompt.fromSense, currentPrompt.targetSense].filter((item): item is SenseKey => Boolean(item))
          const expectedSense = shiftPath[senseShiftStep] ?? shiftPath[shiftPath.length - 1]
          const matched = sense === expectedSense

          if (!matched) {
            recordNoting({
              sense,
              inputType: 'tap',
              attentionType: 'open',
              source: 'prompted',
              prompt: { isCorrect: false },
            })
            playPromptResultTone(false, audioContextRef, settings.audioFeedbackEnabled)
            setSenseShiftStep(sense === shiftPath[0] ? 1 : 0)
            if (shouldFlashSenseFeedback) flash(sense)
            return
          }

          const nextStep = senseShiftStep + 1
          if (nextStep < shiftPath.length) {
            setSenseShiftStep(nextStep)
            if (shouldFlashSenseFeedback) flash(sense)
            return
          }

          recordNoting({
            sense,
            inputType: 'tap',
            attentionType: 'open',
            source: 'prompted',
            prompt: { isCorrect: true },
          })
          playPromptResultTone(true, audioContextRef, settings.audioFeedbackEnabled)
          setSenseShiftStep(0)
          if (shouldFlashSenseFeedback) flash(sense)
          return
        }

        // In guided tap-only modes (guided, targeted, granularity, sense-shift, reaction),
        // a slightly long press should still count as the prompted tap instead of being dropped.
        const isPromptCorrect = currentPrompt ? sense === currentPrompt.targetSense : null

        recordNoting({
          sense,
          inputType: 'tap',
          attentionType: 'open',
          source: 'prompted',
          prompt: isPromptCorrect != null ? { isCorrect: isPromptCorrect } : undefined,
        })

        if (isPromptCorrect != null) {
          if (!isReactionMode) {
            playPromptResultTone(isPromptCorrect, audioContextRef, settings.audioFeedbackEnabled)
          }
        }

        if (shouldFlashSenseFeedback) flash(sense)
        return
      }
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
        if (!isReactionMode) {
          playPromptResultTone(isPromptCorrect, audioContextRef, settings.audioFeedbackEnabled)
        }
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
  const mode = active?.config.mode ?? plannedMode
  const isReactionMode = mode === 'reaction'
  const isGranularityMode = mode === 'guided_granularity'
  const isSenseShiftMode = mode === 'sense_shift'
  const isFreeMode = mode === 'free'
  isFreeModRef.current = isFreeMode
  const isFocusedMode = mode === 'focused'
  const isGuidedShiftMode = mode === 'guided_shift'
  const isGuided = isGuidedMode(mode)
  const currentPrompt = active?.currentPrompt ?? null
  const shiftPathForDisplay = isSenseShiftMode && currentPrompt?.kind === 'transition'
    ? (currentPrompt.transitionPath
      ?? [currentPrompt.fromSense, currentPrompt.targetSense].filter((item): item is SenseKey => Boolean(item)))
    : null
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
    setSenseShiftStep(0)
  }, [isSenseShiftMode, currentPrompt?.id])

  useEffect(() => {
    if (active && isGuided && !isSenseShiftMode && !isReactionMode && !active.currentPrompt) {
      queueNextPrompt()
    }
  }, [active, isGuided, isSenseShiftMode, isReactionMode, queueNextPrompt])

  useEffect(() => {
    if (!active || !isReactionMode || isPaused) return
    if (active.currentPrompt) return

    if (reactionPromptTimerRef.current) {
      clearTimeout(reactionPromptTimerRef.current)
    }

    const delayMs = Math.floor(Math.random() * 2000) + 1
    reactionPromptTimerRef.current = setTimeout(() => {
      queueNextPrompt()
    }, delayMs)

    return () => {
      if (reactionPromptTimerRef.current) {
        clearTimeout(reactionPromptTimerRef.current)
      }
    }
  }, [active, isReactionMode, isPaused, queueNextPrompt])

  useEffect(() => {
    if (!active || !isSenseShiftMode || isPaused) return
    if (active.currentPrompt) return

    if (shiftPromptTimerRef.current) {
      clearTimeout(shiftPromptTimerRef.current)
    }

    // Add breathing room so users can actually follow the requested transition sequence.
    shiftPromptTimerRef.current = setTimeout(() => {
      queueNextPrompt()
    }, 650)

    return () => {
      if (shiftPromptTimerRef.current) {
        clearTimeout(shiftPromptTimerRef.current)
      }
    }
  }, [active, isSenseShiftMode, isPaused, queueNextPrompt])

  useEffect(() => {
    if (!active || !isGranularityMode || isPaused) return
    if (active.currentPrompt) return

    if (granularityPromptTimerRef.current) {
      clearTimeout(granularityPromptTimerRef.current)
    }

    // Give the user a beat to process each aspect cue before the next one appears.
    granularityPromptTimerRef.current = setTimeout(() => {
      queueNextPrompt()
    }, 550)

    return () => {
      if (granularityPromptTimerRef.current) {
        clearTimeout(granularityPromptTimerRef.current)
      }
    }
  }, [active, isGranularityMode, isPaused, queueNextPrompt])

  useEffect(() => {
    if (!isGuided || !currentPrompt || isPaused) return
    if (isReactionMode) return
    if (!settings.spokenFeedbackEnabled || !('speechSynthesis' in window)) return
    if (spokenPromptIdRef.current === currentPrompt.id) return

    spokenPromptIdRef.current = currentPrompt.id
    const utterance = new SpeechSynthesisUtterance(currentPrompt.cue)
    utterance.rate = 0.92
    utterance.pitch = 0.95
    utterance.volume = 0.65
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }, [isGuided, isReactionMode, currentPrompt, isPaused, settings.spokenFeedbackEnabled])

  useEffect(() => {
    if (!isReactionMode || !currentPrompt || isPaused) return
    if (currentPrompt.kind !== 'reaction') return
    if (reactionStimulusIdRef.current === currentPrompt.id) return

    reactionStimulusIdRef.current = currentPrompt.id
    if (currentPrompt.targetSense === 'see') {
      setReactionFlashActive(true)
      if (reactionFlashTimerRef.current) {
        clearTimeout(reactionFlashTimerRef.current)
      }
      reactionFlashTimerRef.current = setTimeout(() => setReactionFlashActive(false), 180)
    } else if (currentPrompt.targetSense === 'hear') {
      playReactionStimulusBeep(audioContextRef)
    }
  }, [isReactionMode, currentPrompt, isPaused])

  useEffect(() => {
    return () => {
      if (freeSpeechTimerRef.current) {
        clearTimeout(freeSpeechTimerRef.current)
      }
      if (reactionFlashTimerRef.current) {
        clearTimeout(reactionFlashTimerRef.current)
      }
      if (shiftPromptTimerRef.current) {
        clearTimeout(shiftPromptTimerRef.current)
      }
      if (granularityPromptTimerRef.current) {
        clearTimeout(granularityPromptTimerRef.current)
      }
      if (reactionPromptTimerRef.current) {
        clearTimeout(reactionPromptTimerRef.current)
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
      {showIntro && (
        <section className={styles.introCard}>
          <h3 className={styles.introTitle}>Quick Training Phase</h3>
          <p className={styles.introMode}>{mode.replace('_', ' ')}</p>
          {getIntroLines(mode).map((line) => (
            <p key={line} className={styles.introLine}>{line}</p>
          ))}
          <div className={styles.introActions}>
            <button className={styles.introBtnPrimary} onClick={beginSession}>Start Session</button>
            <button
              className={styles.introBtnSecondary}
              onClick={speakIntro}
            >
              Play Voice Guide
            </button>
            <button
              className={styles.introBtnSecondary}
              onClick={() => {
                if ('speechSynthesis' in window) {
                  window.speechSynthesis.cancel()
                }
                beginSession()
              }}
            >
              Skip Voice
            </button>
          </div>
        </section>
      )}

      <SenseFeedbackOverlay
        sense={activeSense}
        visible={settings.feedbackEnabled}
        styleMode={settings.visualFeedbackStyle}
      />
      {isReactionMode && <div className={`${styles.reactionFlash} ${reactionFlashActive ? styles.reactionFlashActive : ''}`} />}
      <div className={styles.modeLabel}>{
        isReactionMode
          ? 'Reaction Training'
          : isGranularityMode
          ? 'Guided Granularity'
          : isSenseShiftMode
            ? 'Sense Door Shifting'
          : isFreeMode
          ? 'Free Noting'
          : mode === 'targeted'
            ? 'Targeted Training'
            : mode === 'focused'
              ? 'Focused Attention'
              : mode === 'guided_shift'
                ? 'Guided Shift'
                : mode === 'spatial_feel'
                  ? 'Spatial Feel'
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

      {isGranularityMode && !isPaused && (
        <p className={styles.guidance}>Do not switch objects. Keep tapping the same sense for new details.</p>
      )}

      {isSenseShiftMode && !isPaused && (
        <p className={styles.guidance}>Drop the old sense instantly. Do not drag it with you.</p>
      )}

      {mode === 'spatial_feel' && !isPaused && (
        <p className={styles.guidance}>Prompt says the direction. You respond with Feel every time.</p>
      )}

      {isReactionMode && !isPaused && (
        <>
          <div className={styles.flashWarning} role="status" aria-live="polite">
            Flashing light warning: visual pulses will appear.
          </div>
          <p className={styles.guidance}>Neural warm-up: react to flash as See and beep as Hear.</p>
        </>
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
              : currentPrompt.kind === 'reaction'
                ? 'Flash = See, Beep = Hear. Respond fast.'
                : currentPrompt.kind === 'transition'
                  ? shiftPathForDisplay
                    ? `Follow in order (${Math.min(senseShiftStep + 1, shiftPathForDisplay.length)}/${shiftPathForDisplay.length}).`
                    : 'Follow the sequence in order.'
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

function playReactionStimulusBeep(audioContextRef: { current: AudioContext | null }) {
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return
  if (!audioContextRef.current) {
    audioContextRef.current = new AudioCtor()
  }

  const context = audioContextRef.current
  if (context.state === 'suspended') {
    void context.resume()
  }
  const now = context.currentTime
  const osc = context.createOscillator()
  const gain = context.createGain()

  osc.type = 'sine'
  osc.frequency.value = 880

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.14, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)

  osc.connect(gain)
  gain.connect(context.destination)
  osc.start(now)
  osc.stop(now + 0.16)
}
