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
  {
    id: 'spatial_feel',
    level: 9,
    title: 'Spatial Feel',
    description: 'Basic body-space prompts: Feel up/down/left/right/forward/back.',
    guided: true,
    supportsHold: false,
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
const SPATIAL_DIRECTIONS = ['up', 'down', 'left', 'right', 'forward', 'back'] as const

type GranularityTier = 'core' | 'deeper' | 'micro' | 'advanced'

interface GranularityAspect {
  tier: GranularityTier
  prompt: string
}

const GRANULARITY_CATALOG: Record<SenseKey, GranularityAspect[]> = {
  see: [
    { tier: 'core', prompt: 'Notice color' },
    { tier: 'core', prompt: 'Notice light vs dark' },
    { tier: 'core', prompt: 'Notice shape' },
    { tier: 'core', prompt: 'Notice size' },
    { tier: 'core', prompt: 'Notice location in space' },
    { tier: 'core', prompt: 'Notice movement' },
    { tier: 'deeper', prompt: 'Notice edges (sharp or soft)' },
    { tier: 'deeper', prompt: 'Notice contrast' },
    { tier: 'deeper', prompt: 'Notice depth (near or far)' },
    { tier: 'deeper', prompt: 'Notice focus vs blur' },
    { tier: 'deeper', prompt: 'Notice transparency or reflection' },
    { tier: 'deeper', prompt: 'Notice pattern and repetition' },
    { tier: 'micro', prompt: 'Notice tiny visual flicker or change' },
    { tier: 'micro', prompt: 'Notice visual noise' },
    { tier: 'micro', prompt: 'Notice tiny movement shifts' },
    { tier: 'micro', prompt: 'Notice gradients and transitions' },
    { tier: 'advanced', prompt: 'Notice inner visual imagery' },
    { tier: 'advanced', prompt: 'Notice memory flashes in the visual field' },
    { tier: 'advanced', prompt: 'Notice imagination overlays' },
  ],
  hear: [
    { tier: 'core', prompt: 'Notice pitch (high or low)' },
    { tier: 'core', prompt: 'Notice volume (loud or quiet)' },
    { tier: 'core', prompt: 'Notice rhythm and timing' },
    { tier: 'core', prompt: 'Notice duration (short or long)' },
    { tier: 'deeper', prompt: 'Notice tone quality or timbre' },
    { tier: 'deeper', prompt: 'Notice sound texture' },
    { tier: 'deeper', prompt: 'Notice direction in space' },
    { tier: 'deeper', prompt: 'Notice distance (near or far)' },
    { tier: 'deeper', prompt: 'Notice echo or reverb' },
    { tier: 'micro', prompt: 'Notice the attack at sound onset' },
    { tier: 'micro', prompt: 'Notice decay as sound fades' },
    { tier: 'micro', prompt: 'Notice subtle vibration quality' },
    { tier: 'micro', prompt: 'Notice quiet background hums' },
    { tier: 'deeper', prompt: 'Notice foreground vs background layers' },
    { tier: 'deeper', prompt: 'Notice multiple simultaneous sources' },
    { tier: 'advanced', prompt: 'Notice inner speech as sound' },
    { tier: 'advanced', prompt: 'Notice imagined sounds' },
  ],
  feel: [
    { tier: 'core', prompt: 'Notice pressure' },
    { tier: 'core', prompt: 'Notice temperature' },
    { tier: 'core', prompt: 'Notice movement (expand or contract)' },
    { tier: 'core', prompt: 'Notice contact points' },
    { tier: 'deeper', prompt: 'Notice tingling' },
    { tier: 'deeper', prompt: 'Notice pulsing or heartbeat' },
    { tier: 'deeper', prompt: 'Notice tightness or tension' },
    { tier: 'deeper', prompt: 'Notice softness or relaxation' },
    { tier: 'deeper', prompt: 'Notice itch or irritation' },
    { tier: 'deeper', prompt: 'Notice vibration' },
    { tier: 'deeper', prompt: 'Notice breath in chest or belly' },
    { tier: 'deeper', prompt: 'Notice gut sensation shifts' },
    { tier: 'deeper', prompt: 'Notice location and boundaries in the body' },
    { tier: 'micro', prompt: 'Zoom into tiny flickering sensations' },
    { tier: 'micro', prompt: 'Notice waves and tiny pulses' },
    { tier: 'micro', prompt: 'Notice shifting intensity moment to moment' },
    { tier: 'advanced', prompt: 'Notice heaviness, openness, or contraction' },
    { tier: 'advanced', prompt: 'Notice agitation in the body field' },
  ],
  // taste key is used for smell/taste channel in this app.
  taste: [
    { tier: 'core', prompt: 'Notice taste quality (sweet, sour, salty, bitter, umami)' },
    { tier: 'core', prompt: 'Notice smell intensity (strong or faint)' },
    { tier: 'core', prompt: 'Notice pleasant vs unpleasant tone' },
    { tier: 'core', prompt: 'Notice familiar vs unfamiliar quality' },
    { tier: 'deeper', prompt: 'Notice sharp vs dull smell/taste tone' },
    { tier: 'deeper', prompt: 'Notice flavor blend (taste plus smell)' },
    { tier: 'deeper', prompt: 'Notice aftertaste' },
    { tier: 'deeper', prompt: 'Notice lingering vs instant quality' },
    { tier: 'micro', prompt: 'Notice fading vs intensifying change' },
    { tier: 'micro', prompt: 'Notice subtle background smells' },
    { tier: 'micro', prompt: 'Notice breath-related taste shifts' },
  ],
}

function getAllowedGranularityTiers(elapsedMs: number): GranularityTier[] {
  if (elapsedMs < 12000) return ['core']
  if (elapsedMs < 25000) return ['core', 'deeper']
  if (elapsedMs < 40000) return ['core', 'deeper', 'micro']
  return ['core', 'deeper', 'micro', 'advanced']
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
      cue: `Sense: ${SENSES[targetSense].label}`,
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

    const allowedTiers = getAllowedGranularityTiers(elapsedMs)
    const pool = GRANULARITY_CATALOG[targetSense].filter((aspect) => allowedTiers.includes(aspect.tier))
    const picked = pool[Math.floor(Math.random() * pool.length)]
    const cue = `${SENSES[targetSense].label}: ${picked.prompt}`

    return {
      id: nanoid(),
      kind: 'sense',
      cue,
      targetSense,
      presentedAtMs: elapsedMs,
    }
  }

  if (mode === 'spatial_feel') {
    const direction = SPATIAL_DIRECTIONS[Math.floor(Math.random() * SPATIAL_DIRECTIONS.length)]

    return {
      id: nanoid(),
      kind: 'sense',
      cue: `Feel ${direction}`,
      targetSense: 'feel',
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
