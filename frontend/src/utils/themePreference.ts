export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'workbench-theme-pref'

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'light'
}

export function setThemePreference(pref: ThemePreference) {
  localStorage.setItem(STORAGE_KEY, pref)
}

export function resolveThemeMode(pref: ThemePreference): ResolvedThemeMode {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function applyDocumentTheme(mode: ResolvedThemeMode) {
  document.documentElement.dataset.theme = mode
}
