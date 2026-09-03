import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getWorkbenchTheme } from '@/theme/antdTheme'
import {
  applyDocumentTheme,
  getThemePreference,
  resolveThemeMode,
  setThemePreference,
  type ResolvedThemeMode,
  type ThemePreference,
} from '@/utils/themePreference'

interface ThemeContextValue {
  preference: ThemePreference
  resolvedMode: ResolvedThemeMode
  setPreference: (pref: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useThemePreference() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useThemePreference must be used within ThemeProvider')
  }
  return ctx
}

interface ThemeProviderProps {
  children: ReactNode
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => getThemePreference())
  const [resolvedMode, setResolvedMode] = useState<ResolvedThemeMode>(() =>
    resolveThemeMode(getThemePreference()),
  )

  useEffect(() => {
    applyDocumentTheme(resolvedMode)
  }, [resolvedMode])

  useEffect(() => {
    if (preference !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setResolvedMode(resolveThemeMode('system'))
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [preference])

  const theme = useMemo(() => getWorkbenchTheme(resolvedMode), [resolvedMode])

  const contextValue = useMemo(
    () => ({
      preference,
      resolvedMode,
      setPreference: (next: ThemePreference) => {
        setThemePreference(next)
        setPreferenceState(next)
        setResolvedMode(resolveThemeMode(next))
      },
    }),
    [preference, resolvedMode],
  )

  return (
    <ThemeContext.Provider value={contextValue}>
      <ConfigProvider theme={theme} locale={zhCN}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
