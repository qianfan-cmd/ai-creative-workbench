import { theme, type ThemeConfig } from 'antd'

export type ThemeMode = 'light' | 'dark'

const sharedToken = {
  colorSuccess: '#059669',
  colorWarning: '#D97706',
  colorError: '#DC2626',
  borderRadius: 8,
  borderRadiusLG: 12,
  fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontSize: 14,
  controlHeight: 36,
  lineHeight: 1.5,
}

const lightToken = {
  ...sharedToken,
  colorPrimary: '#18181B',
  colorText: '#18181B',
  colorTextSecondary: '#71717A',
  colorBorder: '#E4E4E7',
  colorBgLayout: '#F7F7F8',
  colorBgContainer: '#FFFFFF',
  colorLink: '#0D9488',
  colorLinkHover: '#0F766E',
}

const darkToken = {
  ...sharedToken,
  colorPrimary: '#2DD4BF',
  colorText: '#FAFAFA',
  colorTextSecondary: '#A1A1AA',
  colorBorder: '#27272A',
  colorBgLayout: '#09090B',
  colorBgContainer: '#18181B',
  colorLink: '#2DD4BF',
  colorLinkHover: '#5EEAD4',
}

const sharedComponents = {
  Button: {
    primaryShadow: 'none',
    defaultShadow: 'none',
    fontWeight: 500,
  },
  Card: {
    paddingLG: 24,
  },
  Table: {
    headerColor: '#71717A',
    rowHoverBg: '#FAFAFA',
  },
  Input: {
    activeShadow: '0 0 0 2px rgba(13, 148, 136, 0.12)',
  },
}

/** @deprecated Use getWorkbenchTheme(mode) for theme-aware preview */
export const workbenchTheme: ThemeConfig = getWorkbenchTheme('light')

export function getWorkbenchTheme(mode: ThemeMode): ThemeConfig {
  const isDark = mode === 'dark'

  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: isDark ? darkToken : lightToken,
    components: {
      ...sharedComponents,
      Table: {
        ...sharedComponents.Table,
        headerBg: isDark ? '#27272A' : '#F7F7F8',
        rowHoverBg: isDark ? '#27272A' : '#FAFAFA',
      },
      Input: {
        activeShadow: isDark
          ? '0 0 0 2px rgba(45, 212, 191, 0.16)'
          : '0 0 0 2px rgba(13, 148, 136, 0.12)',
      },
    },
  }
}
