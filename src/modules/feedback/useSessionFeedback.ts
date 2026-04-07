import { useEffect, useRef } from 'react'
import type { SenseKey, VisualFeedbackStyle } from '../session/types'
import { SENSES } from '../session/types'

interface FeedbackOptions {
  activeSense: SenseKey | null
  feedbackToken: number
  audioEnabled: boolean
  spokenEnabled: boolean
}

const FREQUENCIES: Record<SenseKey, number> = {
  see: 523.25,
  hear: 659.25,
  feel: 392.0,
}

export function useSessionFeedback({
  activeSense,
  feedbackToken,
  audioEnabled,
  spokenEnabled,
}: FeedbackOptions) {
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!activeSense || feedbackToken === 0) return

    if (audioEnabled) {
      playTone(activeSense, audioContextRef)
    }

    if (spokenEnabled && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(SENSES[activeSense].label)
      utterance.rate = 0.85
      utterance.pitch = 0.9
      utterance.volume = 0.5
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    }
  }, [activeSense, feedbackToken, audioEnabled, spokenEnabled])
}

function playTone(sense: SenseKey, audioContextRef: React.MutableRefObject<AudioContext | null>) {
  const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return

  if (!audioContextRef.current) {
    audioContextRef.current = new AudioCtor()
  }

  const context = audioContextRef.current
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const now = context.currentTime

  oscillator.type = 'sine'
  oscillator.frequency.value = FREQUENCIES[sense]

  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.04, now + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)

  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.14)
}

export function getFeedbackDisplay(sense: SenseKey, style: VisualFeedbackStyle) {
  const meta = SENSES[sense]

  if (style === 'label') {
    return { primary: meta.label, secondary: null }
  }

  if (style === 'emoji') {
    return { primary: meta.emoji, secondary: null }
  }

  return { primary: meta.emoji, secondary: meta.label }
}
