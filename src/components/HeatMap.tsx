import type { SessionStats } from '../modules/session/types'
import { SENSES } from '../modules/session/types'
import type { SenseKey } from '../modules/session/types'
import styles from './HeatMap.module.css'

interface Props {
  stats: SessionStats
}

export function HeatMap({ stats }: Props) {
  const max = Math.max(...Object.values(stats.countBySense), 1)

  return (
    <div className={styles.grid}>
      {(Object.keys(SENSES) as SenseKey[]).map((key) => {
        const meta = SENSES[key]
        const count = stats.countBySense[key]
        const intensity = count / max // 0..1
        return (
          <div
            key={key}
            className={styles.cell}
            style={{
              '--color': meta.color,
              '--intensity': intensity,
            } as React.CSSProperties}
          >
            <span className={styles.emoji}>{meta.emoji}</span>
            <span className={styles.count}>{count}</span>
            <span className={styles.label}>{meta.label}</span>
          </div>
        )
      })}
    </div>
  )
}
