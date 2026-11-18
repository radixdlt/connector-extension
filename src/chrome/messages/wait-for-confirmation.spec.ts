import { describe, expect, it } from 'vitest'
import { Subject } from 'rxjs'
import { okAsync } from 'neverthrow'
import { Logger } from 'tslog'
import { createMessage } from './create-message'
import { MessageClient } from './message-client'
import { MessageSubjects } from './subjects'
import { waitForConfirmation } from './wait-for-confirmation'
import type { Message } from './_types'

describe('waitForConfirmation', () => {
  it("resolves with the data of the message's confirmation, and stops listening", async () => {
    const messages$ = new Subject<Message>()
    const result = waitForConfirmation(messages$, 'message-1', 1000)

    messages$.next(createMessage.confirmationSuccess('offScreen', 'other', 1))
    messages$.next(
      createMessage.confirmationSuccess('offScreen', 'message-1', 2),
    )

    expect((await result)._unsafeUnwrap()).toBe(2)
    expect(messages$.observed).toBe(false)
  })

  it('fails with the error of the confirmation', async () => {
    const messages$ = new Subject<Message>()
    const result = waitForConfirmation(messages$, 'message-1', 1000)

    messages$.next(
      createMessage.confirmationError('offScreen', 'message-1', {
        reason: 'tabNotFound',
      }),
    )

    expect((await result)._unsafeUnwrapErr()).toEqual({ reason: 'tabNotFound' })
  })

  it('fails when no confirmation comes in time, and stops listening', async () => {
    const messages$ = new Subject<Message>()

    const result = await waitForConfirmation(messages$, 'message-1', 10)

    expect(result._unsafeUnwrapErr()).toEqual({ reason: 'confirmationTimeout' })
    expect(messages$.observed).toBe(false)
  })

  it('lets a message client give up on a confirmation that never comes', async () => {
    const subjects = MessageSubjects()
    const client = MessageClient(
      () => okAsync({ sendConfirmation: false }),
      'background',
      {
        logger: new Logger({ type: 'hidden' }),
        subjects,
        sendMessage: () => okAsync(undefined),
        confirmationTimeout: 10,
      },
    )

    const result = await client.sendMessageAndWaitForConfirmation(
      createMessage.restartConnector(),
    )

    expect(result._unsafeUnwrapErr()).toEqual({ reason: 'confirmationTimeout' })
    client.destroy()
  })
})
