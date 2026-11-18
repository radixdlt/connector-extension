import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as BackgroundClient from './router/clients/background'

const call = vi.fn(() => Promise.resolve())
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- types the mock's argument
const method = vi.fn((_name: string) => call)
vi.mock('./router/clients/background', async (importOriginal) => ({
  ...(await importOriginal<typeof BackgroundClient>()),
  getBackgroundClient: () => Promise.resolve(method),
}))

const { handleInboundMessage } = await import('./handleInboundMessage')

const dAppEvent = (detail: unknown) => new CustomEvent('test', { detail })

describe("the content script's calls to the background", () => {
  afterEach(() => {
    method.mockClear()
    call.mockClear()
  })

  it('calls the public methods of the background', async () => {
    await handleInboundMessage(dAppEvent({ discriminator: 'extensionStatus' }))
    await handleInboundMessage(dAppEvent({ discriminator: 'openPopup' }))

    expect(method.mock.calls.map(([name]) => name)).toEqual([
      'extensionStatus',
      'openPopup',
    ])
  })

  it('does not call it for a dApp request, which it has no method for', async () => {
    await handleInboundMessage(
      dAppEvent({ discriminator: 'walletInteraction', interactionId: 'a' }),
    )
    await handleInboundMessage(dAppEvent({ discriminator: 'toString' }))
    await handleInboundMessage(dAppEvent({ nothing: true }))

    expect(method).not.toHaveBeenCalled()
  })
})
