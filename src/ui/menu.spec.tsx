import { describe, it, expect, afterEach, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { MenuButton } from './menu'
import { Collapse } from './collapse'

describe('MenuButton', () => {
  let root: Root
  let container: HTMLDivElement
  const rename = vi.fn()
  const forget = vi.fn()

  const render = () => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() =>
      root.render(
        <MenuButton
          label="Options for Pixel"
          items={[
            { label: 'Rename', onSelect: rename },
            { label: 'Forget', onSelect: forget },
          ]}
        >
          ⋮
        </MenuButton>,
      ),
    )
  }
  const trigger = () => container.querySelector('button')!
  const menu = () => container.querySelector('[role="menu"]')
  const items = () =>
    Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]'))
  const key = (key: string) =>
    act(() => {
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true }),
      )
    })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.clearAllMocks()
  })

  it('opens a named menu, with the focus on its first item', () => {
    render()
    expect(menu()).toBeNull()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')

    act(() => trigger().click())

    expect(menu()!.getAttribute('aria-label')).toBe('Options for Pixel')
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(items()[0])
  })

  it('moves between the items with the arrows, and Escape gives the focus back', () => {
    render()
    act(() => trigger().click())

    key('ArrowDown')
    expect(document.activeElement).toBe(items()[1])
    key('ArrowDown')
    expect(document.activeElement).toBe(items()[0])
    key('End')
    expect(document.activeElement).toBe(items()[1])
    key('Escape')

    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('runs the chosen action and closes', () => {
    render()
    act(() => trigger().click())

    act(() => items()[1].click())

    expect(forget).toHaveBeenCalledTimes(1)
    expect(rename).not.toHaveBeenCalled()
    expect(menu()).toBeNull()
  })

  it('closes on a click elsewhere', () => {
    render()
    act(() => trigger().click())

    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })

    expect(menu()).toBeNull()
  })
})

describe('Collapse', () => {
  it('marks its open state for the styles', () => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    const root = createRoot(container)
    act(() => root.render(<Collapse open={false}>content</Collapse>))
    expect(container.firstElementChild!.className).toBe('rdx-collapse')
    act(() => root.render(<Collapse open>content</Collapse>))
    expect(container.firstElementChild!.className).toBe(
      'rdx-collapse rdx-collapse--open',
    )
    act(() => root.unmount())
  })
})
