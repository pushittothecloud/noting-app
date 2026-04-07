import { useNavigate } from 'react-router-dom'
import { MODES } from '../modules/training/modes'
import { useSettingsStore } from '../modules/settings/settingsStore'
import styles from './Home.module.css'

export function Home() {
  const navigate = useNavigate()
  const { settings, update } = useSettingsStore()
  const durationOptions: Array<{ label: string; value: number | null }> = [
    { label: '30s', value: 30 },
    { label: '60s', value: 60 },
    { label: '120s', value: 120 },
    { label: 'Open', value: null },
  ]

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Noting</h1>
      <p className={styles.sub}>Train your sensory awareness with free noting or guided response practice.</p>

      <section className={styles.durationPanel}>
        <span className={styles.durationLabel}>Session Length</span>
        <div className={styles.durationButtons}>
          {durationOptions.map((option) => {
            const selected = settings.defaultDurationSec === option.value
            return (
              <button
                key={option.label}
                className={`${styles.durationBtn} ${selected ? styles.durationBtnActive : ''}`}
                onClick={() => update({ defaultDurationSec: option.value })}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </section>

      <div className={styles.modeGrid}>
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`${styles.modeCard} ${settings.defaultMode === m.id ? styles.selected : ''}`}
            onClick={() => {
              update({ defaultMode: m.id })
              navigate('/session', {
                state: { durationSec: settings.defaultDurationSec },
              })
            }}
          >
            <span className={styles.level}>Lvl {m.level}</span>
            <span className={styles.modeTitle}>{m.title}</span>
            <span className={styles.modeDesc}>{m.description}</span>
          </button>
        ))}
      </div>

      <div className={styles.keyMap}>
        <div className={styles.keyRow}>
          <kbd>↑ W</kbd><span>See</span>
        </div>
        <div className={styles.keyRow}>
          <kbd>→ D</kbd><span>Hear</span>
        </div>
        <div className={styles.keyRow}>
          <kbd>← A</kbd><span>Feel</span>
        </div>
      </div>
    </main>
  )
}
