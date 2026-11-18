import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  applyTheme,
  getThemePreference,
  resolveTheme,
  setThemePreference,
  themeStorageKey,
} from './theme'

const stubStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
  })
  return items
}
const stubSystemDark = (dark: boolean) =>
  vi.stubGlobal('matchMedia', () => ({ matches: dark }))

describe('theme', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete document.documentElement.dataset.theme
  })

  it('is classic by default, and with an unknown stored value', () => {
    stubStorage()
    expect(getThemePreference()).toBe('classic')
    stubStorage({ [themeStorageKey]: 'neon' })
    expect(getThemePreference()).toBe('classic')
  })

  it('resolves "system" to light or dark', () => {
    stubSystemDark(true)
    expect(resolveTheme('system')).toBe('dark')
    stubSystemDark(false)
    expect(resolveTheme('system')).toBe('light')
    expect(resolveTheme('classic')).toBe('classic')
  })

  it('stores the preference and applies it to the document', () => {
    const items = stubStorage()
    stubSystemDark(false)

    setThemePreference('dark')
    expect(items.get(themeStorageKey)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')

    setThemePreference('classic')
    expect(applyTheme()).toBe('classic')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('still applies a theme without storage: the default one', () => {
    vi.stubGlobal('localStorage', undefined)
    stubSystemDark(true)

    expect(applyTheme()).toBe('classic')
  })
})
