import { useEffect, useState } from 'react'

/**
 * The look of the extension's pages: the Radix Wallet's light or dark palette (or
 * whichever the system uses), or the classic one, the connector's original blue
 * gradient.
 */
export type ThemePreference = 'system' | 'light' | 'dark' | 'classic'
export type Theme = Exclude<ThemePreference, 'system'>

export const themePreferences: readonly ThemePreference[] = [
  'system',
  'light',
  'dark',
  'classic',
]

/**
 * Kept in the extension's `localStorage`, shared by its pages (popup, side panel,
 * options page) and read synchronously: a page is drawn in its theme from the
 * start, without a flash of the other one.
 */
export const themeStorageKey = 'radix-connector-theme'

/** Until another one is chosen: the connector's classic look. */
export const defaultThemePreference: ThemePreference = 'classic'

const darkQuery = '(prefers-color-scheme: dark)'

const isThemePreference = (value: unknown): value is ThemePreference =>
  themePreferences.includes(value as ThemePreference)

export const getThemePreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(themeStorageKey)
    return isThemePreference(stored) ? stored : defaultThemePreference
  } catch (error) {
    return defaultThemePreference
  }
}

const systemIsDark = () => {
  try {
    return window.matchMedia(darkQuery).matches
  } catch (error) {
    return false
  }
}

export const resolveTheme = (preference: ThemePreference): Theme =>
  preference === 'system' ? (systemIsDark() ? 'dark' : 'light') : preference

/** Sets `data-theme` on the document: the CSS of every view follows it. */
export const applyTheme = (preference = getThemePreference()) => {
  const theme = resolveTheme(preference)
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
  return theme
}

export const setThemePreference = (preference: ThemePreference) => {
  try {
    localStorage.setItem(themeStorageKey, preference)
  } catch (error) {
    // Not stored: this page still changes.
  }
  applyTheme(preference)
}

/**
 * Applies the theme, then keeps it in step with the system's (for "system") and
 * with changes made in the extension's other open pages.
 */
export const initTheme = () => {
  applyTheme()
  const onChange = () => applyTheme()
  try {
    window.matchMedia(darkQuery).addEventListener('change', onChange)
  } catch (error) {
    // No media queries: the theme stays as applied.
  }
  window.addEventListener('storage', (event) => {
    if (event.key === themeStorageKey) onChange()
  })
}

/** The theme preference, and how to change it, for the settings. */
export const useThemePreference = () => {
  const [preference, setPreference] = useState(getThemePreference)

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === themeStorageKey) setPreference(getThemePreference())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  return [
    preference,
    (next: ThemePreference) => {
      setThemePreference(next)
      setPreference(next)
    },
  ] as const
}
