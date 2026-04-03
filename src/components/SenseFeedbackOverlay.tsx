import type { SenseKey, VisualFeedbackStyle } from '../modules/session/types'
import { getFeedbackDisplay } from '../modules/feedback/useSessionFeedback'
import styles from './SenseFeedbackOverlay.module.css'

interface Props {
  sense: SenseKey | null
  visible: boolean
  styleMode: VisualFeedbackStyle
}

export function SenseFeedbackOverlay({ sense, visible, styleMode }: Props) {
  if (!sense || !visible) return null

  const display = getFeedbackDisplay(sense, styleMode)

  return (
    <div className={styles.overlay} aria-live="polite" aria-atomic="true">
      <div className={styles.pill}>
        <span className={styles.primary}>{display.primary}</span>
        {display.secondary && <span className={styles.secondary}>{display.secondary}</span>}
      </div>
    </div>
  )
}
