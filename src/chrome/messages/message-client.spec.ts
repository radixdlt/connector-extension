import { RequestTracker } from 'chrome/offscreen/requests/request-tracker'
import { DAppRequestDispatcher } from 'chrome/offscreen/requests/dapp-request-dispatcher'
import { errAsync, okAsync } from 'neverthrow'
import { filter, firstValueFrom } from 'rxjs'
import { Logger } from 'tslog'
import { BackgroundMessageHandler } from '../background/message-handler'
import { createMessage } from './create-message'
import { MessageClient } from './message-client'
import { MessageSubjects } from './subjects'
import { ContentScriptMessageHandler } from 'chrome/content-script/message-handler'
import type { Message } from './_types'
import { SessionRouter } from 'chrome/offscreen/session-router'
import { describe, it } from 'vitest'

const logger = new Logger()

const createInput = (subjects: MessageSubjects) => ({
  logger,
  subjects,
  sendMessage: (message: Message, tabId?: number) => {
    logger.debug('sendMessage', { message, tabId })
    subjects.messageSubject.next({ message, tabId })

    return okAsync(undefined)
  },
})

const createTestHelper = ({
  messageClientSubjects = MessageSubjects(),
  backgroundMessageClient = MessageClient(
    BackgroundMessageHandler({
      logger,
      getConnections: () => okAsync({}),
    }),
    'background',
    createInput(messageClientSubjects),
  ),
  contentScriptMessageClient = MessageClient(
    ContentScriptMessageHandler({
      sendMessageEventToDapp: () => okAsync(undefined),
      sendMessageToDapp: () => okAsync(undefined),
      logger,
    }),
    'contentScript',
    createInput(messageClientSubjects),
  ),
}: Partial<{
  backgroundMessageClient: MessageClient
  contentScriptMessageClient: MessageClient
  messageClientSubjects: MessageSubjects
}>) => {
  // The offscreen document's side, without wallet links: it only passes answers on.
  const dispatcher = DAppRequestDispatcher({
    links: new Map(),
    requestTracker: RequestTracker(),
    sessionRouter: SessionRouter(),
    logger,
    expiry: () => 'never',
    messaging: createInput(messageClientSubjects),
  })

  /** A dApp request from tab `tabId`: the dispatcher remembers its tab. */
  const mockDappRequest = (interactionId: string, tabId: number) =>
    messageClientSubjects.messageSubject.next({
      message: createMessage.dAppRequest('contentScript', {
        interactionId,
        metadata: {
          version: 2,
          origin: 'http://localhost:3000',
          networkId: 1,
          dAppDefinitionAddress: 'account_tdx_dapp',
        },
        items: { discriminator: 'unauthorizedRequest' },
      } as any),
      tabId,
    })

  const mockIncomingWalletMessage = (message: { interactionId: string }) =>
    dispatcher.linkDispatch.walletResponse(message, {
      link: 'mock',
      walletPublicKey: 'mock',
    })

  return {
    subjects: messageClientSubjects,
    backgroundMessageClient,
    contentScriptMessageClient,
    mockDappRequest,
    mockIncomingWalletMessage,
    dispatcher,
  }
}

describe('message client', () => {
  // offScreenPage does not have have access to the chrome tabs API
  // so it has to proxy the message through background message handler
  it('should send wallet response to dApp', async () => {
    const testHelper = createTestHelper({})
    testHelper.mockDappRequest('456', 1)
    testHelper.mockIncomingWalletMessage({ interactionId: '456' })

    await Promise.all([
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(({ message }) => message.discriminator === 'sendMessageToTab'),
        ),
      ),
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(({ message }) => message.discriminator === 'walletResponse'),
        ),
      ),
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(
            ({ message }) =>
              message.discriminator === 'confirmation' &&
              message.source === 'contentScript',
          ),
        ),
      ),
    ])
  })

  it('should fail to send message to dApp if tab is missing', async () => {
    const subjects = MessageSubjects()
    const testHelper = createTestHelper({
      messageClientSubjects: subjects,
      backgroundMessageClient: MessageClient(
        BackgroundMessageHandler({
          logger,
          getConnections: () => okAsync({}),
        }),
        'background',
        {
          logger,
          subjects,
          sendMessage: (message, tabId?: number) => {
            if (message.discriminator === 'walletResponse')
              return errAsync({
                reason: 'tabNotFound',
                message: 'could not find tab, user may have closed it',
              })
            subjects.messageSubject.next({ message, tabId })
            return okAsync(undefined)
          },
        },
      ),
    })

    testHelper.mockDappRequest('456', 1)
    testHelper.mockIncomingWalletMessage({ interactionId: '456' })

    await Promise.all([
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(({ message }) => message.discriminator === 'sendMessageToTab'),
        ),
      ),
      firstValueFrom(
        testHelper.subjects.messageSubject.pipe(
          filter(
            ({ message }) =>
              message.discriminator === 'confirmation' &&
              message.source === 'background' &&
              message.success === false &&
              message.error.reason === 'tabNotFound',
          ),
        ),
      ),
    ])
  })
})
