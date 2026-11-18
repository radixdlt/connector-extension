import { okAsync } from 'neverthrow'
import { describe, expect, it, vi } from 'vitest'
import { createMessage } from 'chrome/messages/create-message'
import { MessagesRouter } from 'chrome/offscreen/wallet-connection/messages-router'
import { SessionRouter } from 'chrome/offscreen/session-router'
import { WalletConnectionMessageHandler } from './message-handler'

const createHandler = () => {
  const incomingWalletMessageQueue = { add: vi.fn(() => okAsync(undefined)) }
  const dAppRequestQueue = {
    add: vi.fn(() => okAsync(undefined)),
    cancel: vi.fn(() => okAsync(undefined)),
  }
  const forgetRequest = vi.fn()
  const handler = WalletConnectionMessageHandler({
    dAppRequestQueue: dAppRequestQueue as any,
    extensionToWalletQueue: { add: vi.fn(() => okAsync(undefined)) } as any,
    incomingWalletMessageQueue: incomingWalletMessageQueue as any,
    messagesRouter: MessagesRouter(),
    sessionRouter: SessionRouter(),
    walletPublicKey: 'wallet',
    forgetRequest,
  })
  const sendMessageWithConfirmation = vi.fn(() => okAsync(undefined)) as any
  return {
    handler,
    incomingWalletMessageQueue,
    forgetRequest,
    sendMessageWithConfirmation,
  }
}

describe('WalletConnectionMessageHandler', () => {
  it('queues a wallet answer under its interaction id', async () => {
    const { handler, incomingWalletMessageQueue, sendMessageWithConfirmation } =
      createHandler()
    const answer = { discriminator: 'success', interactionId: 'abc' }

    await handler(
      createMessage.walletMessage('wallet', answer),
      sendMessageWithConfirmation,
    )

    expect(incomingWalletMessageQueue.add).toHaveBeenCalledWith(answer, 'abc')
  })

  it.each([
    { discriminator: 'walletPresence', inBackground: true },
    { discriminator: 'walletRequests', interactionIds: [] },
    { discriminator: 'linkRemoved' },
    { discriminator: 'success', interactionId: '' },
  ])(
    'never queues a wallet message without an interaction id: %j',
    async (message) => {
      const {
        handler,
        incomingWalletMessageQueue,
        sendMessageWithConfirmation,
      } = createHandler()

      const result = await handler(
        createMessage.walletMessage('wallet', message),
        sendMessageWithConfirmation,
      )

      expect(result.isOk()).toBe(true)
      expect(incomingWalletMessageQueue.add).not.toHaveBeenCalled()
    },
  )

  it('tells the transport to forget a cancelled request', async () => {
    const { handler, forgetRequest, sendMessageWithConfirmation } =
      createHandler()

    await handler(
      createMessage.cancelWalletInteraction({
        discriminator: 'cancelWalletInteraction',
        interactionId: 'abc',
        metadata: {
          origin: 'https://dapp.example',
          dAppDefinitionAddress: 'account_tdx_2_abc',
          version: 2,
          networkId: 2,
        },
      }) as any,
      sendMessageWithConfirmation,
      1,
    )

    expect(forgetRequest).toHaveBeenCalledWith('abc')
  })
})
