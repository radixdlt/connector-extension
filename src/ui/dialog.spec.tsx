import { describe, it, expect, afterEach, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { RenameWalletLink } from 'pairing/components/rename-wallet-link'
import { ForgetThisWallet } from 'pairing/components/forget-this-wallet'

describe('wallet dialogs', () => {
  let root: Root
  let container: HTMLDivElement

  const render = (element: JSX.Element) => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(element))
  }
  const button = (name: string) =>
    Array.from(container.querySelectorAll('button')).find(
      (element) => element.textContent === name,
    )!
  const type = (value: string) => {
    const input = container.querySelector('input')!
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('is a named modal dialog that Escape cancels', () => {
    const cancel = vi.fn()
    render(<ForgetThisWallet forgetWallet={() => undefined} cancel={cancel} />)

    const dialog = container.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(
      document.getElementById(dialog.getAttribute('aria-labelledby')!)
        ?.textContent,
    ).toBe('Forget This Wallet')

    act(() => {
      dialog.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    })
    expect(cancel).toHaveBeenCalled()
  })

  it('closes from the button in its corner, as Cancel did', () => {
    const cancel = vi.fn()
    render(<ForgetThisWallet forgetWallet={() => undefined} cancel={cancel} />)

    act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Close"]')!
        .click(),
    )

    expect(cancel).toHaveBeenCalled()
    expect(button('Cancel')).toBeUndefined()
  })

  it('forgets the wallet on confirmation', () => {
    const forget = vi.fn()
    render(<ForgetThisWallet forgetWallet={forget} cancel={() => undefined} />)

    act(() => button('Forget').click())

    expect(forget).toHaveBeenCalled()
  })

  it('renames only to a new, non-empty name', () => {
    const updateName = vi.fn()
    render(
      <RenameWalletLink
        initialValue="Phone"
        isInitial={false}
        cancel={() => undefined}
        updateName={updateName}
      />,
    )

    expect(button('Update').disabled).toBe(true)
    type('')
    expect(button('Update').disabled).toBe(true)
    expect(container.textContent).toContain('Name cannot be empty')
    type('Work phone')
    act(() => button('Update').click())

    expect(updateName).toHaveBeenCalledWith('Work phone')
  })

  it('lets a new link keep its proposed name', () => {
    const updateName = vi.fn()
    render(
      <RenameWalletLink
        initialValue="Radix Wallet"
        isInitial
        cancel={() => undefined}
        updateName={updateName}
      />,
    )

    act(() => button('Confirm').click())

    expect(updateName).toHaveBeenCalledWith('Radix Wallet')
  })

  it('selects the proposed name, so that typing replaces it', () => {
    render(
      <RenameWalletLink
        initialValue="Radix Wallet 1"
        isInitial
        cancel={() => undefined}
        updateName={() => undefined}
      />,
    )

    const input = container.querySelector('input')!
    expect(document.activeElement).toBe(input)
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 14])
  })
})
