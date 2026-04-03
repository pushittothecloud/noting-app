import { create } from 'zustand'
import type { SenseKey } from '../session/types'
import { SENSES } from '../session/types'

interface FeedbackStore {
  activeSense: SenseKey | null
  feedbackToken: number
  flash: (sense: SenseKey) => void
  clear: () => void
}

export const useFeedbackStore = create<FeedbackStore>()((set) => ({
  activeSense: null,
  feedbackToken: 0,

  flash(sense) {
    set((state) => ({
      activeSense: sense,
      feedbackToken: state.feedbackToken + 1,
    }))

    setTimeout(
      () =>
        set((state) =>
          state.activeSense === sense
            ? { activeSense: null }
            : state
        ),
      400
    )
  },

  clear() {
    set({ activeSense: null })
  },
}))
