import { describe, expect, it } from 'vitest'
import { createMessage } from './create-message'

describe('createMessage', () => {
  it('builds a message of its discriminator, with its payload and a new id', () => {
    const first = createMessage.cancelPendingRequest('req-1')
    const second = createMessage.cancelPendingRequest('req-1')

    expect(first).toEqual({
      source: 'popup',
      discriminator: 'cancelPendingRequest',
      interactionId: 'req-1',
      messageId: expect.any(String),
    })
    expect(first.messageId).not.toBe(second.messageId)
  })

  it('keeps the id of the message a confirmation answers', () => {
    expect(
      createMessage.confirmationSuccess('offScreen', 'message-1', { ok: 1 }),
    ).toEqual({
      source: 'offScreen',
      discriminator: 'confirmation',
      success: true,
      messageId: 'message-1',
      data: { ok: 1 },
    })
  })
})
