import { useSettingsStore } from '../modules/settings/settingsStore'
import { MODES } from '../modules/training/modes'
import styles from './Settings.module.css'
import { useState, useEffect, useRef } from 'react'
import type { SenseKey, KeyMap } from '../modules/session/types'
import { SENSES } from '../modules/session/types'
import { DEFAULT_KEY_MAP, formatKey } from '../modules/input/inputTypes'

// ─── Settings screen ──────────────────────────────────────────────────────────

export function Settings() {
  const { settings, update, reset } = useSettingsStore()

  return (
    <main className={styles.page}>
      <h2 className={styles.heading}>Settings</h2>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Feedback</h3>
        <Toggle
          label="Visual feedback"
          description="Shows a calm visual confirmation when you note a sense"
          checked={settings.feedbackEnabled}
          onChange={(v) => update({ feedbackEnabled: v })}
        />
        <label className={styles.fieldRow}>
          <span>Visual style</span>
          <select
            value={settings.visualFeedbackStyle}
            onChange={(e) => update({ visualFeedbackStyle: e.target.value as typeof settings.visualFeedbackStyle })}
            className={styles.select}
          >
            <option value="label">Label</option>
            <option value="emoji">Emoji</option>
            <option value="both">Emoji + label</option>
          </select>
        </label>
        <Toggle
          label="Tone feedback"
          description="Plays a soft tone for each selected sense"
          checked={settings.audioFeedbackEnabled}
          onChange={(v) => update({ audioFeedbackEnabled: v })}
        />
        <Toggle
          label="Spoken confirmation"
          description="Speaks the sense label after each note"
          checked={settings.spokenFeedbackEnabled}
          onChange={(v) => update({ spokenFeedbackEnabled: v })}
        />
        <Toggle
          label="Inner / Outer tagging"
          description="Enables distinguishing inner (mental) vs outer (physical) stimuli"
          checked={settings.innerOuterEnabled}
          onChange={(v) => update({ innerOuterEnabled: v })}
        />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Ambience</h3>
        <Toggle
          label="Background audio"
          description="Ambient sound to enrich the sensory field"
          checked={settings.backgroundAudio}
          onChange={(v) => update({ backgroundAudio: v })}
        />
        <Toggle
          label="Background visuals"
          description="Subtle visual motion to enrich the sensory field"
          checked={settings.backgroundVisuals}
          onChange={(v) => update({ backgroundVisuals: v })}
        />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Defaults</h3>

        <label className={styles.fieldRow}>
          <span>Default mode</span>
          <select
            value={settings.defaultMode}
            onChange={(e) => update({ defaultMode: e.target.value as typeof settings.defaultMode })}
            className={styles.select}
          >
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                Lvl {m.level} – {m.title}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fieldRow}>
          <span>Session duration (seconds, 0 = open-ended)</span>
          <input
            type="number"
            min={0}
            step={30}
            value={settings.defaultDurationSec ?? 0}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10)
              update({ defaultDurationSec: val === 0 ? null : val })
            }}
            className={styles.input}
          />
        </label>

        <label className={styles.fieldRow}>
          <span>Theme</span>
          <select
            value={settings.theme}
            onChange={(e) => update({ theme: e.target.value as 'dark' | 'light' })}
            className={styles.select}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </section>

      <KeyMapEditor
        keyMap={settings.keyMap}
        onChange={(keyMap) => update({ keyMap })}
        onReset={() => update({ keyMap: DEFAULT_KEY_MAP })}
      />

      <button className={styles.resetBtn} onClick={() => { if (confirm('Reset all settings?')) reset() }}>
        Reset All Settings
      </button>
    </main>
  )
}

// ─── Key map editor ───────────────────────────────────────────────────────────

type CapturingSlot = { sense: SenseKey; slot: 'primary' | 'secondary' } | null

function KeyMapEditor({
  keyMap,
  onChange,
  onReset,
}: {
  keyMap: KeyMap
  onChange: (m: KeyMap) => void
  onReset: () => void
}) {
  const [capturing, setCapturing] = useState<CapturingSlot>(null)
  const capturingRef = useRef<CapturingSlot>(null)
  capturingRef.current = capturing

  useEffect(() => {
    if (!capturing) return

    function handleCapture(e: KeyboardEvent) {
      e.preventDefault()
      const slot = capturingRef.current
      if (!slot) return

      if (e.key === 'Escape') {
        setCapturing(null)
        return
      }

      // Reject keys already bound to a different sense
      const otherSenses = (Object.keys(keyMap) as SenseKey[]).filter((s) => s !== slot.sense)
      const conflict = otherSenses.some(
        (s) =>
          keyMap[s].primary === e.key ||
          keyMap[s].secondary === e.key ||
          (keyMap[s].secondary.length === 1 && keyMap[s].secondary.toUpperCase() === e.key)
      )

      if (!conflict) {
        onChange({
          ...keyMap,
          [slot.sense]: { ...keyMap[slot.sense], [slot.slot]: e.key },
        })
      }
      setCapturing(null)
    }

    window.addEventListener('keydown', handleCapture)
    return () => window.removeEventListener('keydown', handleCapture)
  }, [capturing, keyMap, onChange])

  const senses = Object.keys(SENSES) as SenseKey[]

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Key Bindings</h3>
      <p className={styles.bindingHint}>
        Click a key badge to remap it, then press the new key. Esc to cancel.
      </p>

      <div className={styles.bindingTable}>
        {senses.map((sense) => {
          const meta    = SENSES[sense]
          const binding = keyMap[sense]
          const isPrimary   = capturing?.sense === sense && capturing.slot === 'primary'
          const isSecondary = capturing?.sense === sense && capturing.slot === 'secondary'

          return (
            <div key={sense} className={styles.bindingRow}>
              <span className={styles.bindingEmoji}>{meta.emoji}</span>
              <span className={styles.bindingLabel}>{meta.label}</span>

              <button
                className={`${styles.keyBadge} ${isPrimary ? styles.capturing : ''}`}
                onClick={() => setCapturing({ sense, slot: 'primary' })}
                aria-label={`Remap primary key for ${meta.label}`}
              >
                {isPrimary ? '…' : formatKey(binding.primary)}
              </button>

              <button
                className={`${styles.keyBadge} ${isSecondary ? styles.capturing : ''}`}
                onClick={() => setCapturing({ sense, slot: 'secondary' })}
                aria-label={`Remap secondary key for ${meta.label}`}
              >
                {isSecondary ? '…' : formatKey(binding.secondary)}
              </button>

              <button
                className={styles.bindingResetBtn}
                onClick={() => onChange({ ...keyMap, [sense]: DEFAULT_KEY_MAP[sense] })}
                aria-label={`Reset ${meta.label} to defaults`}
                title="Reset to default"
              >
                ↺
              </button>
            </div>
          )
        })}
      </div>

      <button className={styles.bindingResetAll} onClick={onReset}>
        Reset all bindings
      </button>
    </section>
  )
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className={styles.toggle}>
      <div>
        <div className={styles.toggleLabel}>{label}</div>
        {description && <div className={styles.toggleDesc}>{description}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        className={`${styles.switch} ${checked ? styles.on : ''}`}
        onClick={() => onChange(!checked)}
      />
    </label>
  )
}
