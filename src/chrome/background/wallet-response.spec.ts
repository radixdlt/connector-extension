import { afterEach, describe, expect, it, vi } from 'vitest'
import { onWalletResponse } from './wallet-response'

const stored: Record<string, unknown> = {}

describe('the background, when a wallet answers a dApp', () => {
  afterEach(() => {
    vi.mocked(chrome.storage.local.get).mockReset()
    vi.mocked(chrome.storage.local.set).mockReset()
    for (const key of Object.keys(stored)) delete stored[key]
  })

  const setup = (sessionRouter?: Record<string, string>) => {
    if (sessionRouter) stored.sessionRouter = sessionRouter
    vi.mocked(chrome.storage.local.get).mockImplementation(((key: string) =>
      Promise.resolve(key in stored ? { [key]: stored[key] } : {})) as any)
    vi.mocked(chrome.storage.local.set).mockImplementation(((
      values: Record<string, unknown>,
    ) => {
      Object.assign(stored, values)
      return Promise.resolve()
    }) as any)
  }
  const answer = (discriminator: string, walletPublicKey = 'wallet-a') => ({
    discriminator,
    metadata: { sessionId: 'session-1', walletPublicKey, networkId: 2 },
  })
  const settle = () =>
    new Promise((resolve) => {
      setTimeout(resolve, 10)
    })

  it("routes the dApp's session to the wallet that answered it", async () => {
    setup({ other: 'wallet-b' })

    onWalletResponse(answer('success'))
    await settle()

    expect(stored.sessionRouter).toEqual({
      other: 'wallet-b',
      'session-1': 'wallet-a',
    })
  })

  it('leaves a session routed to another wallet as it is', async () => {
    setup({ 'session-1': 'wallet-b' })
    const warn = vi.fn()

    onWalletResponse(answer('success'), { warn, debug: vi.fn() } as any)
    await settle()

    expect(stored.sessionRouter).toEqual({ 'session-1': 'wallet-b' })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('routes nothing on a failure', async () => {
    setup()

    onWalletResponse(answer('failure'))
    await settle()

    expect(stored.sessionRouter).toBeUndefined()
  })
})
