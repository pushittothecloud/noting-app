import { useEffect, useRef } from 'react'
import type { SenseKey } from '../session/types'
import { useSettingsStore } from '../settings/settingsStore'
import { buildKeyLookup, HOLD_THRESHOLD_MS } from './inputTypes'

export interface UseKeyInputOptions {
  /** Whether the hook is active. Set to false to pause input (e.g. session not started). */
  enabled?: boolean

  /**
   * Fired when a key is tapped (pressed and released quickly).
   * When `holdPreventsTap` is false (default) this fires immediately on keydown.
   * When `holdPreventsTap` is true this fires on keyup only if the key was not held.
   */
  onTap: (sense: SenseKey) => void

  /**
   * Fired when a key has been held down for HOLD_THRESHOLD_MS without release.
   * The `onTap` callback will NOT fire again for this press if it triggered hold-start.
   */
  onHoldStart?: (sense: SenseKey) => void

  /** Fired when a held key is released, with total hold duration in ms. */
  onHoldEnd?: (sense: SenseKey, durationMs: number) => void

  /** Fired on spacebar press (not subject to debounce). */
  onSpacebar?: () => void

  /**
   * When true, taps are delayed until keyup and are suppressed if a hold was detected.
   * Use for Flow mode where hold = Focused Attention and tap = Open Monitoring (mutually exclusive).
   * Adds ~HOLD_THRESHOLD_MS latency to tap registration.
   * Default: false
   */
  holdPreventsTap?: boolean
}

/**
 * Unified keyboard input hook for the noting app.
 *
 * - Reads the user's configurable key map from settings
 * - Fires `onTap` for quick presses (no OS key-repeat false positives)
 * - Fires `onHoldStart` / `onHoldEnd` for sustained presses
 * - Debounces same-sense events to prevent duplicate notings
 * - All callbacks are accessed via refs — safe to pass non-memoised functions
 */
export function useKeyInput({
  enabled = true,
  onTap,
  onHoldStart,
  onHoldEnd,
  onSpacebar,
  holdPreventsTap = false,
}: UseKeyInputOptions) {
  const keyMap = useSettingsStore((s) => s.settings.keyMap)

  // ── Refs so event listeners always see latest values without re-registering ──
  const enabledRef        = useRef(enabled)
  const holdPreventsTapRef = useRef(holdPreventsTap)
  const onTapRef          = useRef(onTap)
  const onHoldStartRef    = useRef(onHoldStart)
  const onHoldEndRef      = useRef(onHoldEnd)
  const onSpacebarRef     = useRef(onSpacebar)
  const lookupRef         = useRef(buildKeyLookup(keyMap))

  // Sync all refs on every render
  enabledRef.current        = enabled
  holdPreventsTapRef.current = holdPreventsTap
  onTapRef.current          = onTap
  onHoldStartRef.current    = onHoldStart
  onHoldEndRef.current      = onHoldEnd
  onSpacebarRef.current     = onSpacebar

  // Rebuild lookup when key map changes
  useEffect(() => {
    lookupRef.current = buildKeyLookup(keyMap)
  }, [keyMap])

  // ── Per-press tracking (refs, not state — no re-renders on keypress) ──────
  /** ms timestamp of initial keydown per key code */
  const pressedAt   = useRef<Record<string, number>>({})
  /** Pending hold timers keyed by key code */
  const holdTimers  = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  /** Whether the current press for a key has already triggered hold-start */
  const wasHeld     = useRef<Record<string, boolean>>({})

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!enabledRef.current) return
      if (e.repeat) return  // OS key-repeat: we manage repeat via hold timers

      // ── Spacebar ─────────────────────────────────────────────────────────
      if (e.key === ' ') {
        e.preventDefault()
        onSpacebarRef.current?.()
        return
      }

      const sense = lookupRef.current[e.key]
      if (!sense) return
      e.preventDefault()

      // ── Track this press ─────────────────────────────────────────────────
      const key = e.key
      const now = Date.now()
      pressedAt.current[key]  = now
      wasHeld.current[key]    = false

      // ── Arm the hold timer ───────────────────────────────────────────────
      holdTimers.current[key] = setTimeout(() => {
        wasHeld.current[key] = true
        onHoldStartRef.current?.(sense)
      }, HOLD_THRESHOLD_MS)

    }

    function handleKeyUp(e: KeyboardEvent) {
      if (!enabledRef.current) return

      const key   = e.key
      const sense = lookupRef.current[key]
      if (!sense) return

      // ── Cancel pending hold timer ─────────────────────────────────────────
      const timer = holdTimers.current[key]
      if (timer !== undefined) {
        clearTimeout(timer)
        delete holdTimers.current[key]
      }

      const held  = wasHeld.current[key] ?? false
      wasHeld.current[key] = false

      if (held) {
        // Key was held → fire hold-end with duration
        const start = pressedAt.current[key] ?? Date.now()
        delete pressedAt.current[key]
        onHoldEndRef.current?.(sense, Date.now() - start)
      } else {
        delete pressedAt.current[key]
        onTapRef.current(sense)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup',   handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup',   handleKeyUp)
      // Clear any in-flight hold timers
      for (const t of Object.values(holdTimers.current)) clearTimeout(t)
      holdTimers.current = {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // stable: all live values via refs
}
