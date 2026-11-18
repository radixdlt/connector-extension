import { afterEach, describe, expect, it, vi } from 'vitest'
import { errAsync, okAsync } from 'neverthrow'
import { Logger } from 'tslog'
import { createMessage } from 'chrome/messages/create-message'
import { MessageSubjects } from 'chrome/messages/subjects'
import type { Message } from 'chrome/messages/_types'
import { queueInteractionErrorType } from 'queues/_types'
import { SessionRouter } from '../session-router'
import { RequestTracker } from './request-tracker'
import {
  DAppRequestDispatcher,
  type DispatchedLink,
} from './dapp-request-dispatcher'

const logger = new Logger({ type: 'hidden' })

/** A link's queue of dApp requests: waiting, or sent to its wallet. */
const FakeLink = (link: string): DispatchedLink & { waiting: Set<string> } => {
  const waiting = new Set<string>()
  const sent = new Set<string>()
  return {
    link,
    walletPublicKey: link.padEnd(64, '0'),
    waiting,
    queueRequest: (request) => {
      waiting.add(request.interactionId)
      return okAsync(undefined)
    },
    cancelRequest: (interactionId) => {
      if (waiting.delete(interactionId)) return okAsync(undefined)
      return errAsync({
        reason: sent.has(interactionId)
          ? queueInteractionErrorType.FailedToCancelJobError
          : queueInteractionErrorType.JobNotFoundError,
      })
    },
    resendRequest: () => okAsync(false),
    forgetRequest: () => okAsync(undefined),
  }
}

const metadata = {
  version: 2,
  origin: 'https://dapp.example.com',
  networkId: 1,
  dAppDefinitionAddress: 'account_tdx_dapp',
}

const setup = (linkNames: string[]) => {
  const subjects = MessageSubjects()
  const sent: { message: Message; tabId?: number }[] = []
  const links = new Map(
    linkNames.map((name) => {
      const link = FakeLink(name)
      return [link.walletPublicKey, link] as const
    }),
  )
  const tracker = RequestTracker({ notifyDelayMs: 0 })
  const sessionRouter = SessionRouter()
  const dispatcher = DAppRequestDispatcher({
    links,
    requestTracker: tracker,
    sessionRouter,
    logger,
    expiry: () => 'never',
    messaging: {
      subjects,
      // The background confirms every message it is given for a tab.
      sendMessage: (message, tabId) => {
        sent.push({ message, tabId })
        if (message.discriminator === 'sendMessageToTab')
          setTimeout(() =>
            subjects.messageSubject.next({
              message: createMessage.confirmationSuccess(
                'background',
                message.messageId,
                undefined,
              ),
            }),
          )
        return okAsync(undefined)
      },
    },
  })
  const fromTab = (message: Message, tabId = 7) =>
    subjects.messageSubject.next({ message, tabId })
  const request = (interactionId: string, sessionId?: string) =>
    fromTab(
      createMessage.walletInteraction({
        interactionId,
        sessionId,
        interaction: {
          interactionId,
          metadata,
          items: { discriminator: 'unauthorizedRequest' },
        },
      } as any),
    )
  const toTab = (discriminator: string) =>
    sent
      .map(({ message }) => message)
      .filter(
        (message: any) =>
          message.discriminator === 'sendMessageToTab' &&
          message.data?.discriminator === discriminator,
      ) as any[]
  const confirmations = () =>
    sent
      .map(({ message }) => message)
      .filter((message) => message.discriminator === 'confirmation') as any[]
  return {
    dispatcher,
    links: [...links.values()],
    tracker,
    sessionRouter,
    fromTab,
    request,
    toTab,
    confirmations,
  }
}

describe('dApp request dispatcher', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('queues a request without a session on every link, and drops it from the others once one delivered it', async () => {
    const { dispatcher, links, tracker, request } = setup(['aaaa', 'bbbb'])

    request('req-1')
    await vi.waitFor(() => expect(tracker.get('req-1')).toBeDefined())
    expect(links.map((link) => link.waiting.has('req-1'))).toEqual([true, true])
    expect(tracker.get('req-1')?.wallets).toEqual(['aaaa', 'bbbb'])

    links[0].waiting.delete('req-1')
    tracker.delivered('req-1', 'aaaa')
    dispatcher.linkDispatch.delivered('req-1', 'aaaa')

    await vi.waitFor(() => expect(links[1].waiting.has('req-1')).toBe(false))
    expect(tracker.get('req-1')?.wallets).toEqual(['aaaa'])
    dispatcher.destroy()
  })

  it('queues a request of a session on the link of its wallet only', async () => {
    const { dispatcher, links, tracker, sessionRouter, request } = setup([
      'aaaa',
      'bbbb',
    ])
    sessionRouter.refreshStore({ 'session-1': links[1].walletPublicKey })

    request('req-2', 'session-1')

    await vi.waitFor(() => expect(tracker.get('req-2')).toBeDefined())
    expect(links.map((link) => link.waiting.has('req-2'))).toEqual([
      false,
      true,
    ])
    dispatcher.destroy()
  })

  it("tells the dApp's tab that the wallet received its request", async () => {
    const { dispatcher, request, toTab } = setup(['aaaa'])
    request('req-3')

    dispatcher.linkDispatch.delivered('req-3', 'aaaa')

    await vi.waitFor(() =>
      expect(
        toTab('sendMessageEventToDapp').map((message) => [
          message.tabId,
          message.data.messageEvent,
        ]),
      ).toEqual([[7, 'receivedByWallet']]),
    )
    dispatcher.destroy()
  })

  it("passes the wallet's answer to the dApp's tab, once", async () => {
    const { dispatcher, tracker, request, toTab } = setup(['aaaa'])
    request('req-4')
    await vi.waitFor(() => expect(tracker.get('req-4')).toBeDefined())
    const answer = { discriminator: 'success', interactionId: 'req-4' }
    const from = { link: 'aaaa', walletPublicKey: 'aaaa'.padEnd(64, '0') }

    const first = await dispatcher.linkDispatch.walletResponse(answer, from)
    const again = await dispatcher.linkDispatch.walletResponse(answer, from)

    expect(first.isOk()).toBe(true)
    expect(again._unsafeUnwrapErr()).toEqual({ reason: 'tabIdNotFound' })
    expect(
      toTab('walletResponse').map(
        (message) => message.data.data.walletResponse,
      ),
    ).toEqual([answer])
    // Answered: its card goes away.
    expect(tracker.get('req-4')).toBeUndefined()
    dispatcher.destroy()
  })

  it("cancels on the dApp's cancel a request waiting on every link, and tells the dApp", async () => {
    const { dispatcher, links, tracker, request, fromTab, toTab } = setup([
      'aaaa',
      'bbbb',
    ])
    request('req-5')
    await vi.waitFor(() => expect(tracker.get('req-5')).toBeDefined())

    fromTab(
      createMessage.cancelWalletInteraction({
        interactionId: 'req-5',
        metadata,
      } as any),
    )

    await vi.waitFor(() =>
      expect(
        toTab('sendMessageEventToDapp').map(
          (message) => message.data.messageEvent,
        ),
      ).toEqual(['requestCancelSuccess']),
    )
    expect(links.some((link) => link.waiting.has('req-5'))).toBe(false)
    expect(tracker.get('req-5')).toBeUndefined()
    dispatcher.destroy()
  })

  it("answers the dApp's cancel of a request no link has waiting with an error", async () => {
    const { dispatcher, fromTab, confirmations } = setup(['aaaa'])

    fromTab(
      createMessage.cancelWalletInteraction({
        interactionId: 'unknown',
        metadata,
      } as any),
    )

    await vi.waitFor(() =>
      expect(confirmations()).toEqual([
        expect.objectContaining({
          success: false,
          error: { reason: queueInteractionErrorType.JobNotFoundError },
        }),
      ]),
    )
    dispatcher.destroy()
  })
})
