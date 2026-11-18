import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { okAsync, errAsync } from 'neverthrow'
import type { WalletConnectionDiagnostics } from 'chrome/offscreen/wallet-connection/transport/diagnostics'
import { requestConnectionDiagnostics } from './connection-diagnostics-client'
import { ConnectionDiagnostics } from './connection-diagnostics'
import { config } from 'config'

vi.mock('./connection-diagnostics-client', () => ({
  requestConnectionDiagnostics: vi.fn(),
}))

const connection: WalletConnectionDiagnostics = {
  walletName: 'Radix Wallet 1',
  walletKey: 'abcd1234',
  transport: 'iroh',
  connected: true,
  iroh: {
    connected: true,
    relayUrlValid: true,
    startFailures: 0,
    session: {
      role: 'connector',
      publicRelays: true,
      relayUrl: 'https://relay.example.com./',
      relayConnected: true,
      state: 'connected',
      path: 'direct',
      rttMs: 42,
      failedAttempts: 1,
      lastError: 'connection ended: replaced by a newer connection',
      summary: 'connector c0ffeec0ff → beef00beef state=connected',
    },
  },
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

describe('ConnectionDiagnostics', () => {
  let container: HTMLDivElement
  let root: Root
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  )

  const render = async ({ advanced = true } = {}) => {
    container = document.createElement('div')
    root = createRoot(container)
    await act(async () => {
      root.render(<ConnectionDiagnostics advanced={advanced} />)
      await sleep(10)
    })
  }

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    writeText.mockClear()
  })

  afterEach(async () => {
    await act(async () => root.unmount())
  })

  const currentOffscreen = {
    instance: '1a2b3c4d',
    build: config.buildId,
    uptimeMs: 60_000,
  }
  const section = (name: string) =>
    container.querySelector(`[data-testid="diagnostics-section-${name}"]`)
      ?.textContent ?? ''

  it('lists each linked wallet: the link, then iroh', async () => {
    vi.mocked(requestConnectionDiagnostics).mockReturnValue(
      okAsync({
        connections: [
          {
            ...connection,
            sendingVia: 'iroh',
            connects: { iroh: 2, webrtc: 0 },
            stats: {
              sent: { iroh: 3, webrtc: 0 },
              received: { iroh: 1, webrtc: 0 },
              fallbacks: 0,
              failed: 0,
              duplicatesDropped: 0,
            },
            pending: { dAppRequests: 1, ledgerResponses: 0 },
            recentEvents: [
              {
                at: 0,
                source: 'iroh',
                event: 'disconnected: replaced by a newer connection',
              },
            ],
          },
        ],
        offscreen: currentOffscreen,
        irohLibraryEvents: [
          {
            at: 0,
            level: 'warn',
            target: 'radix_connect_iroh::session',
            message: 'another endpoint took over this link',
            count: 1,
          },
        ],
      }),
    )

    await render()

    const text = container.textContent ?? ''
    expect(text).toContain('Radix Wallet 1 (abcd1234)')
    expect(section('link')).toContain('Sending viairoh')
    expect(section('link')).toContain(
      'Pending1 dApp requests, 0 ledger responses',
    )
    expect(section('iroh')).toContain('iroh')
    expect(section('iroh')).toContain('Stateconnected')
    expect(section('iroh')).toContain('Pathdirect')
    expect(section('iroh')).toContain('RTT42 ms')
    expect(section('iroh')).toContain(
      'Relaypublic (relay https://relay.example.com/), connected',
    )
    expect(section('iroh')).toContain('Failed attempts1 (failed starts: 0)')
    expect(section('iroh')).toContain(
      'Last errorconnection ended: replaced by a newer connection',
    )
    expect(section('iroh')).toContain('Connections2 (1 reconnection)')
    expect(section('iroh')).toContain('Messagessent 3, received 1')
    expect(section('iroh')).toContain(
      'disconnected: replaced by a newer connection',
    )
    expect(section('WebRTC')).toBe('')
    expect(text).toContain('WebRTC: not used in this mode')
    expect(text).toContain('Offscreen document 1a2b3c4d')
    expect(text).toContain(
      'WARN radix_connect_iroh::session: another endpoint took over this link',
    )
    expect(
      container.querySelector('[data-testid="outdated-build-notice"]'),
    ).toBeNull()
  })

  it('hides what the running version does not report', async () => {
    vi.mocked(requestConnectionDiagnostics).mockReturnValue(
      okAsync({ connections: [connection], offscreen: currentOffscreen }),
    )

    await render()

    const text = container.textContent ?? ''
    for (const label of ['Pending', 'Messages', 'Connections', 'Sending via'])
      expect(text).not.toContain(label)
    expect(text).not.toContain('unknown')
  })

  it('says when the extension was rebuilt but not reloaded', async () => {
    vi.mocked(requestConnectionDiagnostics).mockReturnValue(
      okAsync({
        connections: [connection],
        offscreen: { ...currentOffscreen, build: 'previous-build' },
      }),
    )

    await render()

    expect(
      container.querySelector('[data-testid="outdated-build-notice"]')
        ?.textContent,
    ).toBe(
      'The extension was updated but is still running the previous version: reload it in chrome://extensions to see current diagnostics',
    )
    expect(section('link')).toContain(
      'Pendingnot reported by the running version',
    )
  })

  it('says so too when the offscreen document reports no build', async () => {
    vi.mocked(requestConnectionDiagnostics).mockReturnValue(
      okAsync({ connections: [connection] }),
    )

    await render()

    expect(
      container.querySelector('[data-testid="outdated-build-notice"]'),
    ).not.toBeNull()
  })

  it('copies a text report, from a plain button at the end of its row', async () => {
    vi.mocked(requestConnectionDiagnostics).mockReturnValue(
      okAsync({
        connections: [connection],
        offscreen: { ...currentOffscreen, build: 'previous-build' },
      }),
    )
    await render()
    const copy = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Copy diagnostics to the clipboard"]',
    )!
    expect(copy.className).toContain('rdx-text-button')
    expect(copy.parentElement?.style.justifyContent).toBe('flex-end')
    expect(copy.parentElement?.lastElementChild).toBe(copy)

    await act(async () => {
      copy.click()
      await sleep(10)
    })

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('\nWallet abcd1234\n'),
    )
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('NOTE: The extension was updated'),
    )
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      'Copied',
    )
  })

  it('without advanced diagnostics, shows one line per wallet but copies the whole report', async () => {
    vi.mocked(requestConnectionDiagnostics).mockReturnValue(
      okAsync({
        connections: [
          connection,
          {
            ...connection,
            walletName: 'Radix Wallet 2',
            walletKey: 'ef567890',
            transport: 'webrtcAndIroh',
            connected: false,
            iroh: { ...connection.iroh!, connected: false },
            webRtc: { connected: false, signalingConnected: true },
          },
        ],
        offscreen: currentOffscreen,
      }),
    )
    await render({ advanced: false })

    expect(
      Array.from(
        container.querySelectorAll('[data-testid="wallet-status"]'),
        (line) => line.textContent,
      ),
    ).toEqual([
      'Radix Wallet 1Wallet abcd1234Connected via iroh',
      'Radix Wallet 2Wallet ef567890Not connected',
    ])
    expect(
      container.querySelector('[data-testid^="diagnostics-section"]'),
    ).toBeNull()
    expect(container.textContent).not.toContain('Offscreen document')

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Copy diagnostics to the clipboard"]',
        )!
        .click()
      await sleep(10)
    })
    const report = writeText.mock.calls[0][0]
    expect(report).toContain('  iroh:\n    State: connected\n    Path: direct')
    expect(report).toContain('Offscreen document: 1a2b3c4d')
  })

  it('says when the diagnostics are unavailable', async () => {
    vi.mocked(requestConnectionDiagnostics).mockReturnValue(
      errAsync(new Error('the offscreen document did not answer')),
    )

    await render()

    expect(container.textContent).toContain(
      'Diagnostics unavailable: the offscreen document did not answer',
    )
    expect(container.querySelector('button')?.disabled).toBe(true)
  })
})
