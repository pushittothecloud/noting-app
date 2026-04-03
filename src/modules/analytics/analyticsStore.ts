import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SessionResult } from '../session/types'

interface AnalyticsStore {
  history: SessionResult[]
  addResult: (result: SessionResult) => void
  clearHistory: () => void
}

export const useAnalyticsStore = create<AnalyticsStore>()(
  persist(
    (set) => ({
      history: [],
      addResult(result) {
        set((state) => ({ history: [result, ...state.history].slice(0, 200) }))
      },
      clearHistory() {
        set({ history: [] })
      },
    }),
    { name: 'noting-history' }
  )
)
