import { describe, expect, it } from 'vitest'
import { IncomingDuplicates } from './incoming-duplicates'
import { sendOrderOf } from './send-order'
import type { TransportName } from './diagnostics'

describe('the order a message is sent in', () => {
  const order = (connected: TransportName[], heldBack: TransportName[] = []) =>
    sendOrderOf(['iroh', 'webrtc'], {
      isConnected: (name) => connected.includes(name),
      isPreferred: (name) => name === 'iroh',
      heldBackForMs: (name) => (heldBack.includes(name) ? 1_000 : 0),
    })

  it('prefers a connected preferred transport', () => {
    expect(order(['iroh', 'webrtc'])).toEqual(['iroh', 'webrtc'])
    expect(order(['webrtc'])).toEqual(['webrtc', 'iroh'])
  })

  it('holds a preferred transport back after a failure, while another is connected', () => {
    expect(order(['iroh', 'webrtc'], ['iroh'])).toEqual(['webrtc', 'iroh'])
    // None other connected: it still goes first.
    expect(order(['iroh'], ['iroh'])).toEqual(['iroh', 'webrtc'])
  })
})

describe('copies of a message received over several transports', () => {
  it('finds the first copy within the window, and forgets it after', () => {
    let time = 0
    const duplicates = IncomingDuplicates({ windowMs: 100, now: () => time })
    const message = { interactionId: 'a', discriminator: 'success' }

    expect(duplicates.check(message, 'iroh').first).toBeUndefined()
    time = 50
    expect(duplicates.check({ ...message }, 'webrtc').first).toEqual({
      at: 0,
      via: 'iroh',
    })
    expect(
      duplicates.check({ ...message, interactionId: 'b' }, 'webrtc').first,
    ).toBeUndefined()
    time = 200
    expect(duplicates.check(message, 'webrtc').first).toBeUndefined()
  })
})
