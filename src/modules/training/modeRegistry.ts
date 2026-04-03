import { SENSES, type ActivePrompt, type SenseKey, type TrainingMode } from '../session/types'
import { nanoid } from '../utils/nanoid'

export interface ModeDefinition {
  id: TrainingMode
  level: number
  title: string
  description: string
  guided: boolean
  supportsHold: boolean
}

export const ACTIVE_MODES: ModeDefinition[] = [
  {
    id: 'guided',
    level: 1,
    title: 'Guided',
    description: 'Respond to a prompted sense as quickly and accurately as possible.',
    guided: true,
    supportsHold: false,
  },
  {
    id: 'free',
    level: 2,
    title: 'Free Noting',
    description: 'Label experience as it arises. No prompts, just spontaneous noting.',
    guided: false,
    supportsHold: true,
  },
  {
    id: 'targeted',
    level: 3,
    title: 'Targeted Training',
    description: 'Weighted prompts drilling your weakest senses from the previous session.',
    guided: true,
    supportsHold: false,
  },
  {
    id: 'focused',
    level: 4,
    title: 'Focused Attention',
    description: 'Choose one object, hold while attention is steady, release when it drifts, and re-hold when refocused.',
    guided: false,
    supportsHold: true,
  },
  {
    id: 'guided_shift',
    level: 5,
    title: 'Guided Shift',
    description: 'Randomly alternates between guided noting prompts and guided focus-hold prompts.',
    guided: true,
    supportsHold: true,
  },
]

export function getModeDefinition(mode: TrainingMode): ModeDefinition {
  return (
    ACTIVE_MODES.find((entry) => entry.id === mode) ?? {
      id: mode,
      level: 99,
      title: mode,
      description: 'Experimental mode',
      guided: false,
      supportsHold: true,
    }
  )
}

export function isGuidedMode(mode: TrainingMode) {
  return getModeDefinition(mode).guided
}

const GUIDED_SENSES: SenseKey[] = ['see', 'hear', 'feel', 'taste']

export function createGuidedPrompt(
  elapsedMs: number,
  mode: TrainingMode,
  previousTarget?: SenseKey | null,
  previousKind?: ActivePrompt['kind'] | null,
  senseWeights?: Partial<Record<SenseKey, number>>,
): ActivePrompt {
  // Build a weighted pool, excluding the immediately previous target to avoid repetition
  const pool: SenseKey[] = []
  for (const sense of GUIDED_SENSES) {
    if (sense === previousTarget) continue
    const weight = senseWeights?.[sense] ?? 1
    for (let i = 0; i < weight; i++) pool.push(sense)
  }
  const finalPool = pool.length > 0 ? pool : GUIDED_SENSES
  const targetSense = finalPool[Math.floor(Math.random() * finalPool.length)]

  const shouldUseFocusPrompt =
    mode === 'guided_shift'
      ? previousKind === 'attention'
        ? false
        : previousKind === 'sense'
          ? true
          : Math.random() < 0.5
      : false

  const promptKind: ActivePrompt['kind'] = shouldUseFocusPrompt ? 'attention' : 'sense'
  const cue = shouldUseFocusPrompt
    ? `Focus on ${SENSES[targetSense].label} and hold`
    : `Notice ${SENSES[targetSense].label}`

  return {
    id: nanoid(),
    kind: promptKind,
    cue,
    targetSense,
    presentedAtMs: elapsedMs,
  }
}
