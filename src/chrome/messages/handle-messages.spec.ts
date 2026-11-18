import { describe, expect, it, vi } from 'vitest'
import { okAsync } from 'neverthrow'
import { handleMessages, type Message } from './_types'
import { createMessage } from './create-message'

const send = vi.fn()

describe('handleMessages', () => {
  it('gives a message to its handler, with the sender and the tab', async () => {
    const restartConnector = vi.fn(() => okAsync({ sendConfirmation: true }))
    const handler = handleMessages({ restartConnector })
    const message = createMessage.restartConnector()

    const result = await handler(message, send, 7)

    expect(result._unsafeUnwrap()).toEqual({ sendConfirmation: true })
    expect(restartConnector).toHaveBeenCalledWith(message, send, 7)
  })

  it('leaves other messages to the other parts of the extension', async () => {
    const handler = handleMessages({})

    const result = await handler(createMessage.restartConnector(), send)

    expect(result._unsafeUnwrapErr()).toEqual({
      reason: 'unhandledMessageDiscriminator',
    })
  })

  it('ignores what is not a message of its own, like inherited names', async () => {
    const handler = handleMessages({})

    for (const message of [
      undefined,
      { discriminator: 'constructor' },
      { discriminator: 'toString' },
    ]) {
      const result = await handler(message as unknown as Message, send)
      expect(result._unsafeUnwrapErr().reason).toBe(
        'unhandledMessageDiscriminator',
      )
    }
  })
})
