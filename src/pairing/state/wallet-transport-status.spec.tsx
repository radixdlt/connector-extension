import { extensionPageSender } from 'chrome/messages/senders.test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import type { WalletConnectionDiagnostics } from 'chrome/offscreen/wallet-connection/transport/diagnostics'
import { createMessage } from 'chrome/messages/create-message'
import {
  statusOfLink,
  transportStatusOf,
  useWalletTransportStatus,
} from './wallet-transport-status'

const diagnostics = (
  overrides: Partial<WalletConnectionDiagnostics>,
): WalletConnectionDiagnostics => ({
  walletName: 'Wallet',
  walletKey: 'abcd1234',
  connected: false,
  ...overrides,
})

const webRtc = (connected: boolean) => ({
  connected,
  signalingConnected: true,
})
const iroh = (connected: boolean) => ({
  connected,
  relayUrlValid: true,
  startFailures: 0,
})

describe('transportStatusOf', () => {
  it('names the transport carrying the connection', () => {
    expect(
      transportStatusOf(
        diagnostics({ transport: 'webrtc', webRtc: webRtc(true) }),
      ),
    ).toEqual({ connected: true, label: 'WebRTC' })
    expect(
      transportStatusOf(diagnostics({ transport: 'iroh', iroh: iroh(true) })),
    ).toEqual({ connected: true, label: 'iroh' })
  })

  it('names iroh, which sends the messages, when both are connected', () => {
    expect(
      transportStatusOf(
        diagnostics({
          transport: 'webrtcAndIroh',
          webRtc: webRtc(true),
          iroh: iroh(true),
        }),
      ),
    ).toEqual({ connected: true, label: 'iroh' })
  })

  it('names WebRTC while iroh is held back after a failed send', () => {
    expect(
      transportStatusOf(
        diagnostics({
          transport: 'webrtcAndIroh',
          webRtc: webRtc(true),
          iroh: iroh(true),
          sendingVia: 'webrtc',
          irohHeldBackForMs: 10_000,
        }),
      ),
    ).toEqual({ connected: true, label: 'WebRTC' })
  })

  it('says when no transport is connected', () => {
    expect(
      transportStatusOf(
        diagnostics({
          transport: 'webrtcAndIroh',
          webRtc: webRtc(false),
          iroh: iroh(false),
        }),
      ),
    ).toEqual({ connected: false, label: 'Not connected' })
    expect(transportStatusOf(diagnostics({}))).toEqual({
      connected: false,
      label: 'Not connected',
    })
  })
})

describe('statusOfLink', () => {
  it('names the transport, or says the wallet is not connected', () => {
    expect(statusOfLink('iroh')).toEqual({ connected: true, label: 'iroh' })
    expect(statusOfLink('webrtc')).toEqual({ connected: true, label: 'WebRTC' })
    expect(statusOfLink('none')).toEqual({
      connected: false,
      label: 'Not connected',
    })
  })
})

describe('useWalletTransportStatus', () => {
  let root: Root
  let rendered: ReturnType<typeof useWalletTransportStatus>[]

  const Probe = () => {
    rendered.push(useWalletTransportStatus())
    return null
  }
  const linkStatusesChanged = (statuses: Record<string, string>) =>
    act(async () => {
      // @ts-expect-error vitest-chrome events can be triggered from tests
      chrome.runtime.onMessage.callListeners(
        createMessage.linkStatusesChanged(statuses as any),
        extensionPageSender(),
      )
    })

  beforeEach(async () => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    // @ts-expect-error vitest-chrome events can be reset from tests
    chrome.runtime.onMessage.clearListeners()
    rendered = []
    vi.mocked(chrome.runtime.sendMessage).mockImplementation(((
      message: any,
    ) => {
      if (message.discriminator === 'getLinkStatuses')
        setTimeout(() =>
          // @ts-expect-error vitest-chrome events can be triggered from tests
          chrome.runtime.onMessage.callListeners(
            createMessage.confirmationSuccess('offScreen', message.messageId, {
              statuses: { abcd1234: 'iroh', ef567890: 'none' },
            }),
            extensionPageSender(),
          ),
        )
      return Promise.resolve()
    }) as any)
    root = createRoot(document.createElement('div'))
    await act(async () => {
      root.render(<Probe />)
    })
    await vi.waitFor(() =>
      expect(Object.keys(rendered.at(-1)!)).toHaveLength(2),
    )
  })

  afterEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset()
  })

  it('gives each wallet its status by short key', () => {
    expect(rendered.at(-1)).toEqual({
      abcd1234: { connected: true, label: 'iroh' },
      ef567890: { connected: false, label: 'Not connected' },
    })
    act(() => root.unmount())
  })

  it('follows the changes the offscreen document sends, without asking again', async () => {
    await linkStatusesChanged({ abcd1234: 'webrtc', ef567890: 'iroh' })

    expect(rendered.at(-1)).toEqual({
      abcd1234: { connected: true, label: 'WebRTC' },
      ef567890: { connected: true, label: 'iroh' },
    })
    const asked = vi
      .mocked(chrome.runtime.sendMessage)
      .mock.calls.filter(
        ([message]: any[]) => message.discriminator === 'getLinkStatuses',
      )
    expect(asked).toHaveLength(1)
    act(() => root.unmount())
  })

  it('stops listening once unmounted', () => {
    act(() => root.unmount())

    expect(chrome.runtime.onMessage.hasListeners()).toBe(false)
  })
})
