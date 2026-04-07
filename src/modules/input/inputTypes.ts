import type { SenseKey, KeyMap } from '../session/types'

// ─── Constants ────────────────────────────────────────────────────────────────

/** How long (ms) a key must be held before it becomes a "hold" event */
export const HOLD_THRESHOLD_MS = 120

// ─── Default bindings ─────────────────────────────────────────────────────────

export const DEFAULT_KEY_MAP: KeyMap = {
  see:   { primary: 'ArrowUp',    secondary: 'w' },
  hear:  { primary: 'ArrowRight', secondary: 'd' },
  feel:  { primary: 'ArrowLeft',  secondary: 'a' },
}

// ─── Lookup builder ───────────────────────────────────────────────────────────

/**
 * Derives a { key → SenseKey } reverse-lookup map from a KeyMap.
 * Automatically adds uppercase variants of letter keys.
 */
export function buildKeyLookup(keyMap: KeyMap): Record<string, SenseKey> {
  const lookup: Record<string, SenseKey> = {}
  for (const [senseRaw, binding] of Object.entries(keyMap)) {
    const sense = senseRaw as SenseKey
    lookup[binding.primary] = sense
    lookup[binding.secondary] = sense
    // also accept uppercase (e.g. caps-lock on)
    if (binding.secondary.length === 1) {
      lookup[binding.secondary.toUpperCase()] = sense
    }
  }
  return lookup
}

// ─── Human-readable key labels ────────────────────────────────────────────────

const KEY_LABELS: Record<string, string> = {
  ArrowUp:    '↑',
  ArrowDown:  '↓',
  ArrowLeft:  '←',
  ArrowRight: '→',
  ' ':        'Space',
}

export function formatKey(key: string): string {
  return KEY_LABELS[key] ?? key.toUpperCase()
}
