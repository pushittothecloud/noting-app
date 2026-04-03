import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings } from '../session/types'
import { DEFAULT_SETTINGS } from '../session/types'

interface SettingsStore {
  settings: AppSettings
  update: (patch: Partial<AppSettings>) => void
  reset: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      update(patch) {
        set((state) => ({ settings: { ...state.settings, ...patch } }))
      },
      reset() {
        set({ settings: DEFAULT_SETTINGS })
      },
    }),
    {
      name: 'noting-settings',
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<SettingsStore> | undefined
        return {
          ...currentState,
          ...persisted,
          settings: {
            ...DEFAULT_SETTINGS,
            ...currentState.settings,
            ...persisted?.settings,
          },
        }
      },
    }
  )
)
