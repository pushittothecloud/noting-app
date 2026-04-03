import type { SenseKey } from '../modules/session/types'
import { SENSES } from '../modules/session/types'
import styles from './SenseIndicator.module.css'

interface Props {
  sense: SenseKey
  active?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function SenseIndicator({ sense, active = false, size = 'md' }: Props) {
  const meta = SENSES[sense]
  return (
    <div
      className={`${styles.indicator} ${styles[size]} ${active ? styles.active : ''}`}
      style={{ '--sense-color': meta.color } as React.CSSProperties}
      aria-label={meta.label}
    >
      <span className={styles.emoji}>{meta.emoji}</span>
      <span className={styles.label}>{meta.label}</span>
    </div>
  )
}
