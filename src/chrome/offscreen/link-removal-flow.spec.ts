import { describe, expect, it, vi } from 'vitest'
import { okAsync } from 'neverthrow'
import { of } from 'rxjs'
import { Logger } from 'tslog'
import { MessageClient } from 'chrome/messages/message-client'
import { MessageSubjects } from 'chrome/messages/subjects'
import { createMessage } from 'chrome/messages/create-message'
import { OffscreenMessageHandler } from './message-handler'
import { LogsClient } from './logs-client'
import {
  OffscreenServices,
  WalletConnectionClientFactory,
} from './wallet-connection/factory'
import type { WalletConnectionClient } from './wallet-connection/wallet-connection-client'
import type { LinkRemovalNotices } from './link-removal-notices'

// What the wallet links of these tests share, as an offscreen document's would.
const services = OffscreenServices()
const walletConnectionClientFactory = WalletConnectionClientFactory(services)

const MockTransport = () => ({
  setConnectionPassword: vi.fn(() => okAsync(undefined)),
  setConnectionConfig: vi.fn(),
  sendMessage: vi.fn(() => okAsync(undefined)),
  connected$: of(false),
  onMessage$: of(),
  connect: vi.fn(),
  restart: vi.fn(),
  destroy: vi.fn(),
  diagnostics: vi.fn(() => ({ connected: false })),
})

const pixel = {
  walletPublicKey: 'a'.repeat(64),
  walletName: 'Pixel',
  password: 'aa'.repeat(32),
  accounts: [],
}
const retired = {
  password: pixel.password,
  walletPublicKey: pixel.walletPublicKey,
  walletName: 'Pixel',
  retiredAt: Date.now(),
}

describe('offscreen: notices of forgotten links', () => {
  const setup = () => {
    const notices = {
      update: vi.fn(),
      setConnectionConfig: vi.fn(),
      size: vi.fn(() => 0),
      destroy: vi.fn(),
    } satisfies LinkRemovalNotices
    const client = MessageClient(
      OffscreenMessageHandler({
        services,
        connectionsMap: new Map<string, WalletConnectionClient>(),
        logger: new Logger({ type: 'hidden' }),
        logsClient: LogsClient(),
        walletConnectionClientFactory: (input) =>
          walletConnectionClientFactory({
            ...input,
            transport: MockTransport() as any,
          }),
        linkRemovalNotices: notices,
      }),
      'offScreen',
      {
        logger: new Logger({ type: 'hidden' }),
        subjects: MessageSubjects(),
        sendMessage: () => okAsync(undefined),
      },
    )
    return { client, notices }
  }
  const lastUpdate = (notices: { update: ReturnType<typeof vi.fn> }) =>
    notices.update.mock.calls.at(-1) as [unknown[], Set<string>]

  it('waits until the link is closed before its notice opens it again', async () => {
    const { client, notices } = setup()

    await client.handleMessage(
      createMessage.setConnections('background', {
        [pixel.walletPublicKey]: pixel,
      }),
    )
    await client.handleMessage(
      createMessage.setRetiredLinks('background', [retired]),
    )
    // Still open as a wallet link: the notice is passed on with its password open.
    expect(lastUpdate(notices)[0]).toEqual([retired])
    expect(lastUpdate(notices)[1].has(pixel.password)).toBe(true)

    await client.handleMessage(createMessage.setConnections('background', {}))
    expect(lastUpdate(notices)[1].has(pixel.password)).toBe(false)
  })

  it('gives the notices the transports of the options', async () => {
    const { client, notices } = setup()

    await client.handleMessage(
      createMessage.setConnectorExtensionOptions('background', {
        radixConnectTransport: 'webrtcAndIroh',
      } as any),
    )

    expect(notices.setConnectionConfig).toHaveBeenCalledWith(
      expect.objectContaining({ transport: expect.any(String) }),
    )
  })
})
