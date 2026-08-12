import type { Theme } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'

/** MUJAWIB shared tokens — aligned with Product Bible §4 */
export const mjwTokens = {
  accent: '#5D6CFF',
  canvasLight: '#F7F7F5',
  canvasDark: '#0B0D10',
  surfaceLight: '#FFFFFF',
  surfaceDark: '#12151A',
  surfaceElevatedLight: '#F1F2F4',
  surfaceElevatedDark: '#181C22',
  textPrimaryLight: '#111318',
  textPrimaryDark: '#F4F6F8',
  textMutedLight: '#687180',
  textMutedDark: '#9CA5B2',
  success: '#178A5B',
  warning: '#B57917',
  critical: '#C43B48',
  radiusControl: 12,
  radiusPanel: 16,
} as const

export function createMujawibTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark'

  return createTheme({
    direction: 'rtl',
    cssVariables: {
      colorSchemeSelector: 'data-mui-color-scheme',
    },
    colorSchemes: {
      light: {
        palette: {
          mode: 'light',
          primary: {
            main: mjwTokens.accent,
            contrastText: '#FFFFFF',
          },
          background: {
            default: mjwTokens.canvasLight,
            paper: mjwTokens.surfaceLight,
          },
          text: {
            primary: mjwTokens.textPrimaryLight,
            secondary: mjwTokens.textMutedLight,
          },
          success: { main: mjwTokens.success },
          warning: { main: mjwTokens.warning },
          error: { main: mjwTokens.critical },
        },
      },
      dark: {
        palette: {
          mode: 'dark',
          primary: {
            main: mjwTokens.accent,
            contrastText: '#FFFFFF',
          },
          background: {
            default: mjwTokens.canvasDark,
            paper: mjwTokens.surfaceDark,
          },
          text: {
            primary: mjwTokens.textPrimaryDark,
            secondary: mjwTokens.textMutedDark,
          },
          success: { main: mjwTokens.success },
          warning: { main: mjwTokens.warning },
          error: { main: mjwTokens.critical },
        },
      },
    },
    typography: {
      fontFamily: 'var(--font-tajawal), "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontFamily: 'var(--font-cairo), var(--font-tajawal), sans-serif' },
      h2: { fontFamily: 'var(--font-cairo), var(--font-tajawal), sans-serif' },
      h3: { fontFamily: 'var(--font-cairo), var(--font-tajawal), sans-serif' },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: {
      borderRadius: mjwTokens.radiusControl,
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: mjwTokens.radiusControl,
            paddingInline: '20px',
          },
          containedPrimary: {
            backgroundColor: mjwTokens.accent,
            '&:hover': { backgroundColor: '#4A59E6' },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: mjwTokens.radiusPanel,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            boxShadow: 'none',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: mjwTokens.radiusPanel },
        },
      },
    },
  })
}
