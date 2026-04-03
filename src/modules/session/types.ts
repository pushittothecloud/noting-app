// ─── Sense ────────────────────────────────────────────────────────────────────
export type SenseKey = 'see' | 'hear' | 'feel' | 'taste'

// ─── Key Bindings ─────────────────────────────────────────────────────────────
export interface SenseBinding {
  /** Arrow key (e.g. 'ArrowUp') */
  primary: string
  /** Letter key lowercase (e.g. 'w'). Uppercase variant is derived automatically. */
  secondary: string
}

export type KeyMap = Record<SenseKey, SenseBinding>

export interface SenseMeta {
  key: SenseKey
  label: string
  emoji: string
  arrowKey: string   // e.g. "ArrowUp"
  wasdKey: string    // e.g. "w"
  color: string      // CSS color for the sense
}

export const SENSES: Record<SenseKey, SenseMeta> = {
  see: {
    key: 'see',
    label: 'See',
    emoji: '👁️',
    arrowKey: 'ArrowUp',
    wasdKey: 'w',
    color: '#6ee7f7',
  },
  hear: {
    key: 'hear',
    label: 'Hear',
    emoji: '👂',
    arrowKey: 'ArrowRight',
    wasdKey: 'd',
    color: '#a78bfa',
  },
  feel: {
    key: 'feel',
    label: 'Feel',
    emoji: '🤲',
    arrowKey: 'ArrowLeft',
    wasdKey: 'a',
    color: '#86efac',
  },
  taste: {
    key: 'taste',
    label: 'Smell / Taste',
    emoji: '👃',
    arrowKey: 'ArrowDown',
    wasdKey: 's',
    color: '#fde68a',
  },
}

export const KEY_TO_SENSE: Record<string, SenseKey> = {
  ArrowUp: 'see',
  w: 'see',
  W: 'see',
  ArrowRight: 'hear',
  d: 'hear',
  D: 'hear',
  ArrowLeft: 'feel',
  a: 'feel',
  A: 'feel',
  ArrowDown: 'taste',
  s: 'taste',
  S: 'taste',
}

// ─── Training Modes ───────────────────────────────────────────────────────────
export type TrainingMode =
  | 'reaction'      // Lvl 1 – stimulus-to-response warm-up (flash/beep)
  | 'guided'        // Lvl 2 – prompted response
  | 'guided_granularity' // Lvl 3 – one sense, many sub-notes
  | 'sense_shift'   // Lvl 4 – shift attention between sense doors
  | 'free'          // Lvl 5 – tap freely
  | 'targeted'      // Lvl 6 – weighted prompts on weak senses
  | 'focused'       // Lvl 7 – sustained focus on one chosen object
  | 'guided_shift'  // Lvl 8 – randomly alternates guided note/focus prompts
  | 'spatial_feel'  // Lvl 9 – basic feel-direction prompts
  | 'sustain'       // Lvl 2 – hold a sense for 10+ s
  | 'rapid_fire'    // Lvl 3 – maximise noticings/s
  | 'inner_outer'   // Lvl 4 – inner vs outer tagging
  | 'flow'          // Lvl 5 – FA / OM switching

export type AttentionType = 'focused' | 'open'
export type InputInteraction = 'tap' | 'hold'
export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed'
export type PerceptionOrigin = 'inner' | 'outer' | 'blended' | 'unclassified'
export type EventSource = 'free' | 'prompted'
export type PromptKind = 'sense' | 'reaction' | 'transition' | 'attention' | 'other'
export type VisualFeedbackStyle = 'label' | 'emoji' | 'both'
export type EventQualifier =
  | 'arising'
  | 'passing'
  | 'zoom_in'
  | 'zoom_out'
  | 'transition'
  | 'stable'

export interface PromptContext {
  id?: string
  kind?: PromptKind
  cue?: string
  fromSense?: SenseKey
  transitionPath?: SenseKey[]
  targetSense?: SenseKey
  responseTimeMs?: number
  isCorrect?: boolean
  presentedAtMs?: number
}

export interface ActivePrompt {
  id: string
  kind: PromptKind
  cue: string
  fromSense?: SenseKey
  transitionPath?: SenseKey[]
  targetSense: SenseKey
  presentedAtMs: number
}

export interface EventMetadata {
  [key: string]: string | number | boolean | null | undefined
}

export interface InactivityPeriod {
  startMs: number
  endMs: number
  durationMs: number
}

// ─── Session ──────────────────────────────────────────────────────────────────
export interface NotingEvent {
  id: string
  sessionId: string
  timestamp: number          // ms since session start
  sense: SenseKey
  mode: TrainingMode
  inputType: InputInteraction
  attentionType: AttentionType
  source: EventSource
  perceptionOrigin: PerceptionOrigin
  prompt?: PromptContext
  holdDurationMs?: number
  qualifiers?: EventQualifier[]
  metadata?: EventMetadata
}

export type Noting = NotingEvent

export interface SessionConfig {
  mode: TrainingMode
  durationSec: number | null  // null = open-ended
  guidedMode: boolean
  feedbackEnabled: boolean
  innerOuterEnabled: boolean
  backgroundAudio: boolean
  backgroundVisuals: boolean
  focusedSenses?: SenseKey[]
  focusedSense?: SenseKey
  senseWeights?: Partial<Record<SenseKey, number>>
}

export interface SessionStats {
  totalNotings: number
  notingsPerSecond: number
  fastestNotingMs: number
  slowestNotingMs: number
  fastestStreak: number       // longest consecutive rapid-notings
  lowestSense: SenseKey | null
  countBySense: Record<SenseKey, number>
  guidedAccuracyPct: number | null
  guidedAverageResponseMs: number | null
  averageResponseMsBySense: Record<SenseKey, number | null>
  inactivityPeriods: InactivityPeriod[]
  longestInactivityMs: number
  durationMs: number
}

export interface SessionResult {
  id: string
  startedAt: number           // unix ms
  config: SessionConfig
  notings: NotingEvent[]
  stats: SessionStats
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export interface AppSettings {
  feedbackEnabled: boolean
  visualFeedbackStyle: VisualFeedbackStyle
  audioFeedbackEnabled: boolean
  spokenFeedbackEnabled: boolean
  innerOuterEnabled: boolean
  backgroundAudio: boolean
  backgroundVisuals: boolean
  defaultMode: TrainingMode
  defaultDurationSec: number | null
  theme: 'dark' | 'light'
  keyMap: KeyMap
}

export const DEFAULT_SETTINGS: AppSettings = {
  feedbackEnabled: true,
  visualFeedbackStyle: 'both',
  audioFeedbackEnabled: false,
  spokenFeedbackEnabled: true,
  innerOuterEnabled: false,
  backgroundAudio: false,
  backgroundVisuals: false,
  defaultMode: 'free',
  defaultDurationSec: 60,
  theme: 'dark',
  keyMap: {
    see:   { primary: 'ArrowUp',    secondary: 'w' },
    hear:  { primary: 'ArrowRight', secondary: 'd' },
    feel:  { primary: 'ArrowLeft',  secondary: 'a' },
    taste: { primary: 'ArrowDown',  secondary: 's' },
  },
}
