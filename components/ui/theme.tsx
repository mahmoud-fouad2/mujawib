'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type ColorMode = 'light' | 'dark'

const STORAGE_KEY = 'mjw-theme'

type ThemeValue = { mode: ColorMode; setMode: (m: ColorMode) => void; toggle: () => void }

const ThemeContext = createContext<ThemeValue>({
  mode: 'light',
  setMode: () => {},
  toggle: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

/**
 * Runs before first paint so the page never flashes the wrong ground.
 * Kept as a string because it must be inlined into <head> by the layout.
 */
export const themeInitScript = `(function(){try{
var s=localStorage.getItem('${STORAGE_KEY}');
var m=s==='light'||s==='dark'?s:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
document.documentElement.setAttribute('data-theme',m);
}catch(e){document.documentElement.setAttribute('data-theme','light')}})()`

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>('light')

  // Adopt whatever the pre-paint script already decided.
  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme')
    if (current === 'dark' || current === 'light') setModeState(current)
  }, [])

  const setMode = useCallback((next: ColorMode) => {
    setModeState(next)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // storage unavailable (private mode) — the in-memory mode still applies
    }
  }, [])

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark')
  }, [mode, setMode])

  return <ThemeContext.Provider value={{ mode, setMode, toggle }}>{children}</ThemeContext.Provider>
}
