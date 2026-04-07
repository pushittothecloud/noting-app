import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppSettings } from '../session/types'
import { DEFAULT_SETTINGS } from '../session/types'

function sanitizeKeyMap(keyMap: AppSettings['keyMap'] | undefined): AppSettings['keyMap'] {
  return {
    see: keyMap?.see ?? DEFAULT_SETTINGS.keyMap.see,
    hear: keyMap?.hear ?? DEFAULT_SETTINGS.keyMap.hear,
    feel: keyMap?.feel ?? DEFAULT_SETTINGS.keyMap.feel,
  }
}

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
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...currentState.settings,
          ...persisted?.settings,
        }

        return {
          ...currentState,
          ...persisted,
          settings: {
            ...mergedSettings,
            keyMap: sanitizeKeyMap(mergedSettings.keyMap),
          },
        }
      },
    }
  )
)
