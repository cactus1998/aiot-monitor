import { ref, watch } from 'vue'

/**
 * UI preferences are the only thing this app keeps in localStorage — never
 * business data. Format `{ version: 1, data }`; unknown versions are dropped.
 */
export interface UiPrefs {
  theme: 'light' | 'dark'
}

const KEY = 'aiot:ui'
const VERSION = 1

function systemTheme(): UiPrefs['theme'] {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function loadPrefs(): UiPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as {
      version?: number
      data?: Partial<UiPrefs>
    } | null
    if (raw?.version === VERSION && (raw.data?.theme === 'light' || raw.data?.theme === 'dark')) {
      return { theme: raw.data.theme }
    }
  } catch {
    // Corrupt or blocked storage: fall back to defaults.
  }
  return { theme: systemTheme() }
}

function savePrefs(prefs: UiPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, data: prefs }))
  } catch {
    // Storage full or disabled; preferences just won't persist.
  }
}

const theme = ref<UiPrefs['theme']>(loadPrefs().theme)

watch(
  theme,
  (value) => {
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = value
    savePrefs({ theme: value })
  },
  { immediate: true },
)

export function useTheme() {
  return {
    theme,
    toggle: () => {
      theme.value = theme.value === 'dark' ? 'light' : 'dark'
    },
  }
}
