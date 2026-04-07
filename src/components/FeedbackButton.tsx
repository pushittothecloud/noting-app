import styles from './FeedbackButton.module.css'

const FEEDBACK_URL = 'https://forms.gle/w9nNkHV3kUq7UqRM9'

export function FeedbackButton() {
  return (
    <a
      className={styles.feedbackBtn}
      href={FEEDBACK_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Open feedback form"
    >
      Feedback
    </a>
  )
}
