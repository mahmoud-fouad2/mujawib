'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { ThemeProvider, BaseStyles } from '@primer/react'
import { StyledComponentsRegistry } from './styled-components-registry'

type ColorMode = 'light' | 'dark'

type ThemeContextValue = {
  mode: ColorMode
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'dark',
  toggle: () => {},
})

export function useColorMode() {
  return useContext(ThemeContext)
}

/**
 * App-wide Primer providers with a client-controlled color mode.
 * Keeps <html data-color-mode> and ThemeProvider colorMode in sync so the
 * primitive theme CSS and styled-components always agree.
 */
export function ThemeController({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ColorMode>('dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-color-mode', mode)
  }, [mode])

  const toggle = useCallback(() => {
    setMode((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return (
    <StyledComponentsRegistry>
      <ThemeContext.Provider value={{ mode, toggle }}>
        <ThemeProvider
          colorMode={mode === 'dark' ? 'night' : 'day'}
          dayScheme="light"
          nightScheme="dark"
          preventSSRMismatch
        >
          <BaseStyles>{children}</BaseStyles>
        </ThemeProvider>
      </ThemeContext.Provider>
    </StyledComponentsRegistry>
  )
}
