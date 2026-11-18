import { describe, it, expect, afterEach, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { RadioRow, SwitchRow } from './settings-ui'

describe('settings rows with a value still being read', () => {
  let root: Root
  let container: HTMLDivElement

  const render = (element: JSX.Element) => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    root = createRoot(container)
    act(() => root.render(<ul>{element}</ul>))
  }

  afterEach(() => act(() => root.unmount()))

  it('keeps the place of a switch whose value is unknown, without one to slide', () => {
    const onChange = vi.fn()
    render(<SwitchRow title="Notify" checked={undefined} onChange={onChange} />)

    expect(container.querySelector('input')).toBeNull()
    const placeholder = container.querySelector('.rdx-switch')!
    expect(placeholder.classList).toContain('rdx-value-pending')
    expect(placeholder.getAttribute('aria-hidden')).toBe('true')

    act(() =>
      root.render(
        <ul>
          <SwitchRow title="Notify" checked={false} onChange={onChange} />
        </ul>,
      ),
    )
    const input = container.querySelector<HTMLInputElement>('input')!
    expect(input.checked).toBe(false)
    expect(container.querySelector('.rdx-value-pending')).toBeNull()
  })

  it('keeps the place of a radio button whose value is unknown', () => {
    render(
      <RadioRow
        name="mode"
        value="iroh"
        title="iroh"
        checked={undefined}
        onSelect={() => {}}
      />,
    )

    expect(container.querySelector('input')).toBeNull()
    expect(
      container.querySelector('.rdx-radio.rdx-value-pending'),
    ).not.toBeNull()
  })
})
