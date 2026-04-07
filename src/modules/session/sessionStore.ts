import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  ActivePrompt,
  AttentionType,
  EventMetadata,
  EventQualifier,
  EventSource,
  InputInteraction,
  NotingEvent,
  PerceptionOrigin,
  PromptContext,
  SenseKey,
  SessionConfig,
  SessionResult,
  SessionStatus,
  SessionStats,
} from './types'
import { computeStats } from './sessionUtils'
import { nanoid } from '../utils/nanoid'
import { useAnalyticsStore } from '../analytics/analyticsStore'
import { createGuidedPrompt, isGuidedMode } from '../training/modeRegistry'

interface ActiveSession {
  id: string
  config: SessionConfig
  sessionStartedAt: number
  startedAt: number
  status: SessionStatus
  notings: NotingEvent[]
  lastNotingAt: number | null
  elapsedBeforePauseMs: number
  pausedAt: number | null
  currentPrompt: ActivePrompt | null
  previousPromptTarget: SenseKey | null
  previousPromptKind: ActivePrompt['kind'] | null
}

interface RecordNotingInput {
  sense: SenseKey
  inputType: InputInteraction
  attentionType?: AttentionType
  holdDurationMs?: number
  source?: EventSource
  perceptionOrigin?: PerceptionOrigin
  prompt?: PromptContext
  qualifiers?: EventQualifier[]
  metadata?: EventMetadata
}

interface SessionStore {
  active: ActiveSession | null
  lastResult: SessionResult | null
  status: SessionStatus

  startSession: (config: SessionConfig) => void
  pauseSession: () => void
  resumeSession: () => void
  getElapsedMs: () => number
  queueNextPrompt: () => void
  recordNoting: (input: RecordNotingInput) => void
  endSession: () => SessionResult | null
  clearResult: () => void
}

function getElapsedForSession(active: ActiveSession, now = Date.now()) {
  if (active.status === 'paused' && active.pausedAt != null) {
    return active.elapsedBeforePauseMs
  }

  return active.elapsedBeforePauseMs + (now - active.startedAt)
}

export const useSessionStore = create<SessionStore>()(
  immer((set, get) => ({
    active: null,
    lastResult: null,
    status: 'idle',

    startSession(config) {
      set((state) => {
        state.active = {
          id: nanoid(),
          config,
          sessionStartedAt: Date.now(),
          startedAt: Date.now(),
          status: 'running',
          notings: [],
          lastNotingAt: null,
          elapsedBeforePauseMs: 0,
          pausedAt: null,
          currentPrompt: null,
          previousPromptTarget: null,
          previousPromptKind: null,
        }
        state.lastResult = null
        state.status = 'running'

        if (isGuidedMode(config.mode) && state.active) {
          state.active.currentPrompt = createGuidedPrompt(0, config.mode, null, null, config.senseWeights)
        }
      })
    },

    pauseSession() {
      set((state) => {
        if (!state.active || state.active.status !== 'running') return

        const now = Date.now()
        state.active.elapsedBeforePauseMs += now - state.active.startedAt
        state.active.pausedAt = now
        state.active.startedAt = now
        state.active.status = 'paused'
        state.status = 'paused'
      })
    },

    resumeSession() {
      set((state) => {
        if (!state.active || state.active.status !== 'paused') return

        state.active.startedAt = Date.now()
        state.active.pausedAt = null
        state.active.status = 'running'
        state.status = 'running'
      })
    },

    getElapsedMs() {
      const { active } = get()
      if (!active) return 0
      return getElapsedForSession(active)
    },

    queueNextPrompt() {
      set((state) => {
        if (!state.active || !isGuidedMode(state.active.config.mode)) return
        const elapsedMs = getElapsedForSession(state.active)
        state.active.currentPrompt = createGuidedPrompt(
          elapsedMs,
          state.active.config.mode,
          state.active.previousPromptTarget,
          state.active.previousPromptKind,
          state.active.config.senseWeights,
        )
      })
    },

    recordNoting({
      sense,
      inputType,
      attentionType = 'open',
      holdDurationMs,
      source = 'free',
      perceptionOrigin = 'unclassified',
      prompt,
      qualifiers,
      metadata,
    }) {
      set((state) => {
        if (!state.active || state.active.status !== 'running') return

        const timestampMs = getElapsedForSession(state.active)
        const reactionTimeMs = state.active.lastNotingAt
          ? timestampMs - state.active.lastNotingAt
          : undefined
        const activePrompt = state.active.currentPrompt
        const shouldUsePrompt = source === 'prompted' || (source === 'free' && activePrompt != null && isGuidedMode(state.active.config.mode))
        const resolvedSource: EventSource = shouldUsePrompt ? 'prompted' : source
        const resolvedPrompt = shouldUsePrompt
          ? {
              id: activePrompt?.id,
              kind: activePrompt?.kind ?? 'sense',
              cue: activePrompt?.cue,
              fromSense: activePrompt?.fromSense,
              transitionPath: activePrompt?.transitionPath,
              targetSense: activePrompt?.targetSense,
              presentedAtMs: activePrompt?.presentedAtMs,
              responseTimeMs: prompt?.responseTimeMs ?? (activePrompt ? timestampMs - activePrompt.presentedAtMs : reactionTimeMs),
              isCorrect: prompt?.isCorrect ?? (activePrompt ? sense === activePrompt.targetSense : undefined),
            }
          : prompt

        state.active.notings.push({
          id: nanoid(),
          sessionId: state.active.id,
          timestamp: timestampMs,
          sense,
          mode: state.active.config.mode,
          inputType,
          attentionType,
          source: resolvedSource,
          perceptionOrigin,
          prompt: resolvedPrompt,
          holdDurationMs,
          qualifiers,
          metadata,
        })
        state.active.lastNotingAt = timestampMs

        if (activePrompt) {
          const mode = state.active.config.mode
          const promptWasCorrect = resolvedPrompt?.isCorrect === true

          if ((mode === 'guided_granularity' || mode === 'sense_shift') && !promptWasCorrect) {
            // Keep guided aspect/transition cues active until they are completed correctly.
            return
          }

          state.active.previousPromptTarget = activePrompt.targetSense
          state.active.previousPromptKind = activePrompt.kind
          state.active.currentPrompt = isGuidedMode(state.active.config.mode)
            ? (state.active.config.mode === 'sense_shift' || state.active.config.mode === 'guided_granularity' || state.active.config.mode === 'reaction')
              ? null
              : createGuidedPrompt(
                timestampMs,
                state.active.config.mode,
                activePrompt.targetSense,
                activePrompt.kind,
                state.active.config.senseWeights,
              )
            : null
        }
      })
    },

    endSession() {
      const { active } = get()
      if (!active) return null

      const durationMs = getElapsedForSession(active)
      const stats: SessionStats = computeStats(active.notings, durationMs)

      // find the least-used sense
      const entries = Object.entries(stats.countBySense) as [SenseKey, number][]
      const lowestSense =
        entries.reduce<[SenseKey, number] | null>((min, cur) =>
          min === null || cur[1] < min[1] ? cur : min,
        null)?.[0] ?? null

      const result: SessionResult = {
        id: active.id,
        startedAt: active.sessionStartedAt,
        config: active.config,
        notings: active.notings,
        stats: { ...stats, lowestSense, durationMs },
      }

      set((state) => {
        state.active = null
        state.lastResult = result
        state.status = 'completed'
      })

      useAnalyticsStore.getState().addResult(result)

      return result
    },

    clearResult() {
      set((state) => {
        state.lastResult = null
        if (!state.active) {
          state.status = 'idle'
        }
      })
    },
  }))
)
