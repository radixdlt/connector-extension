import { describe, expect, it, vi } from 'vitest'
import { BehaviorSubject } from 'rxjs'
import { LinkStatusTracker } from './link-statuses'
import type { TransportName } from './wallet-connection/transport/diagnostics'

const walletA = 'a'.repeat(64)
const walletB = 'b'.repeat(64)

describe('LinkStatusTracker', () => {
  it('reports every link by short key, each time one changes', () => {
    const onChange = vi.fn()
    const tracker = LinkStatusTracker({ onChange })
    const a = new BehaviorSubject<TransportName | undefined>(undefined)
    const b = new BehaviorSubject<TransportName | undefined>('webrtc')

    tracker.follow(walletA, a)
    tracker.follow(walletB, b)
    a.next('iroh')
    a.next('iroh')

    expect(onChange).toHaveBeenCalledTimes(3)
    expect(onChange).toHaveBeenLastCalledWith({
      aaaaaaaa: 'iroh',
      bbbbbbbb: 'webrtc',
    })
    expect(tracker.list()).toEqual({ aaaaaaaa: 'iroh', bbbbbbbb: 'webrtc' })
  })

  it('stops following a closed link, and drops it', () => {
    const onChange = vi.fn()
    const tracker = LinkStatusTracker({ onChange })
    const a = new BehaviorSubject<TransportName | undefined>('iroh')
    tracker.follow(walletA, a)

    tracker.forget(walletA)
    a.next('webrtc')

    expect(onChange).toHaveBeenLastCalledWith({})
    expect(a.observed).toBe(false)
  })
})
