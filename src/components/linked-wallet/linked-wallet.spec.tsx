import { describe, it, expect, afterEach, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import type { WalletTransportStatus } from 'pairing/state/wallet-transport-status'
import { LinkedWallet } from './linked-wallet'

describe('LinkedWallet transport status', () => {
  let root: Root | undefined

  afterEach(() => {
    if (root) act(() => root?.unmount())
  })

  const render = (transportStatus?: WalletTransportStatus) => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    root = createRoot(container)
    act(
      () =>
        root?.render(
          <LinkedWallet
            name="Radix Wallet 1"
            isJustLinked={false}
            accounts={[]}
            transportStatus={transportStatus}
            onRenameWalletLink={() => undefined}
            onForgetWallet={() => undefined}
          />,
        ),
    )
    return container.querySelector<HTMLElement>(
      '[data-testid="transport-status"]',
    )!
  }

  it('names the transport in text, not with the colour alone', () => {
    const status = render({ connected: true, label: 'iroh' })

    expect(status.textContent).toBe('Connected via iroh')
    expect(status.title).toBe('Connected via iroh')
    expect(status.classList).toContain('linked-wallet__status--connected')
  })

  it('says when the wallet is not connected', () => {
    const status = render({ connected: false, label: 'Not connected' })

    expect(status.textContent).toBe('Not connected')
    expect(status.title).toBe('Not connected to this wallet')
    expect(status.classList).toContain('linked-wallet__status')
    expect(status.classList).not.toContain('linked-wallet__status--connected')
  })

  it('keeps an empty slot while the status is unknown, so nothing moves', () => {
    const status = render(undefined)

    expect(status).not.toBeNull()
    expect(status.classList).toContain('linked-wallet__status--unknown')
    expect(status.textContent).toBe('')
  })

  it('names its menu button after the wallet', () => {
    const status = render({ connected: true, label: 'WebRTC' })
    const button = status.closest('.linked-wallet')!.querySelector('button')!

    expect(button.getAttribute('aria-label')).toBe('Options for Radix Wallet 1')
    expect(button.getAttribute('aria-haspopup')).toBe('menu')
  })
})

describe('LinkedWallet picture and order', () => {
  let root: Root | undefined
  afterEach(() => {
    if (root) act(() => root?.unmount())
  })

  const render = (props: Partial<Parameters<typeof LinkedWallet>[0]>) => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(
      () =>
        root?.render(
          <LinkedWallet
            name="Pixel"
            isJustLinked={false}
            accounts={[]}
            onRenameWalletLink={() => undefined}
            onForgetWallet={() => undefined}
            {...props}
          />,
        ),
    )
    return container
  }
  const menuLabels = (container: HTMLElement) => {
    act(() =>
      container
        .querySelector<HTMLButtonElement>('[aria-label="Options for Pixel"]')!
        .click(),
    )
    return Array.from(
      document.querySelectorAll('[role="menuitem"]'),
      (item) => item.textContent,
    )
  }

  it('chooses a picture from the avatar, and shows the chosen one', () => {
    const choose = vi.fn()
    const container = render({
      picture: 'data:image/webp;base64,AAAA',
      onChoosePicture: choose,
    })

    const avatar = container.querySelector<HTMLButtonElement>(
      '[aria-label="Choose a picture for Pixel"]',
    )!
    expect(avatar.querySelector('img')!.getAttribute('src')).toBe(
      'data:image/webp;base64,AAAA',
    )
    act(() => avatar.click())
    expect(choose).toHaveBeenCalled()
  })

  it('shows no picture when pictures are hidden', () => {
    const container = render({ showPicture: false, onChoosePicture: vi.fn() })

    expect(container.querySelector('.linked-wallet__icon')).toBeNull()
  })

  it('offers only the actions that apply', () => {
    const container = render({
      picture: 'data:image/webp;base64,AAAA',
      onChoosePicture: vi.fn(),
      onRemovePicture: vi.fn(),
      onMoveDown: vi.fn(),
    })

    expect(menuLabels(container)).toEqual([
      'Rename Wallet Link',
      'Change Picture',
      'Remove Picture',
      'Move Down',
      'Forget Wallet',
    ])
  })
})
