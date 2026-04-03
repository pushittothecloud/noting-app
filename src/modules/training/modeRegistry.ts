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
    id: 'reaction',
    level: 1,
    title: 'Reaction Training',
    description: 'Respond to random flash/beep signals with the matching sense key (See/Hear).',
    guided: true,
    supportsHold: false,
  },
  {
    id: 'guided',
    level: 2,
    title: 'Guided',
    description: 'Respond to a prompted sense as quickly and accurately as possible.',
    guided: true,
    supportsHold: false,
  },
  {
    id: 'guided_granularity',
    level: 3,
    title: 'Guided Granularity',
    description: 'Stay with one sense and extract multiple sub-notes before switching objects.',
    guided: true,
    supportsHold: false,
  },
  {
    id: 'sense_shift',
    level: 4,
    title: 'Sense Door Shifting',
    description: 'Shift attention on command: drop one sense and re-engage the next instantly.',
    guided: true,
    supportsHold: false,
  },
  {
    id: 'free',
    level: 5,
    title: 'Free Noting',
    description: 'Label experience as it arises. No prompts, just spontaneous noting.',
    guided: false,
    supportsHold: true,
  },
  {
    id: 'targeted',
    level: 6,
    title: 'Targeted Training',
    description: 'Weighted prompts drilling your weakest senses from the previous session.',
    guided: true,
    supportsHold: false,
  },
  {
    id: 'focused',
    level: 7,
    title: 'Focused Attention',
    description: 'Choose one object, hold while attention is steady, release when it drifts, and re-hold when refocused.',
    guided: false,
    supportsHold: true,
  },
  {
    id: 'guided_shift',
    level: 8,
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
const GRANULARITY_SUBCUES: Record<SenseKey, string[]> = {
  see: ['color', 'brightness', 'edges', 'shape', 'movement'],
  hear: ['pitch', 'volume', 'rhythm', 'texture', 'direction'],
  feel: ['pressure', 'temperature', 'texture', 'pulsing', 'movement'],
  taste: ['intensity', 'aftertaste', 'location', 'warmth', 'sharpness'],
}

export function createGuidedPrompt(
  elapsedMs: number,
  mode: TrainingMode,
  previousTarget?: SenseKey | null,
  previousKind?: ActivePrompt['kind'] | null,
  senseWeights?: Partial<Record<SenseKey, number>>,
): ActivePrompt {
  if (mode === 'reaction') {
    const targetSense: SenseKey = Math.random() < 0.5 ? 'see' : 'hear'
    return {
      id: nanoid(),
      kind: 'reaction',
      cue: 'Detect signal and respond',
      targetSense,
      presentedAtMs: elapsedMs,
    }
  }

  if (mode === 'sense_shift') {
    const fromSense = previousTarget ?? GUIDED_SENSES[Math.floor(Math.random() * GUIDED_SENSES.length)]
    const nextCandidates = GUIDED_SENSES.filter((sense) => sense !== fromSense)
    const secondSense = nextCandidates[Math.floor(Math.random() * nextCandidates.length)]
    const useThreeDoorPattern = elapsedMs >= 15000

    if (!useThreeDoorPattern) {
      const transitionPath: SenseKey[] = [fromSense, secondSense]
      return {
        id: nanoid(),
        kind: 'transition',
        cue: `${SENSES[fromSense].label} -> ${SENSES[secondSense].label}`,
        fromSense,
        transitionPath,
        targetSense: secondSense,
        presentedAtMs: elapsedMs,
      }
    }

    const thirdCandidates = GUIDED_SENSES.filter((sense) => sense !== secondSense && sense !== fromSense)
    const thirdSense = thirdCandidates[Math.floor(Math.random() * thirdCandidates.length)]

    const transitionPath: SenseKey[] = [fromSense, secondSense, thirdSense]
    return {
      id: nanoid(),
      kind: 'transition',
      cue: `${SENSES[fromSense].label} -> ${SENSES[secondSense].label} -> ${SENSES[thirdSense].label}`,
      fromSense,
      transitionPath,
      targetSense: thirdSense,
      presentedAtMs: elapsedMs,
    }
  }

  if (mode === 'guided_granularity') {
    const stayOnSameSense = previousTarget != null && Math.random() < 0.68
    const targetSense = stayOnSameSense
      ? previousTarget
      : GUIDED_SENSES[Math.floor(Math.random() * GUIDED_SENSES.length)]

    const aspect = GRANULARITY_SUBCUES[targetSense][Math.floor(Math.random() * GRANULARITY_SUBCUES[targetSense].length)]
    const cue = `${SENSES[targetSense].label}: ${aspect}`

    return {
      id: nanoid(),
      kind: 'sense',
      cue,
      targetSense,
      presentedAtMs: elapsedMs,
    }
  }

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
