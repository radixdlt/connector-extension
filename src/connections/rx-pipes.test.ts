import { message$ } from './websocket'
import { subscribeSpyTo } from '@hirez_io/observer-spy'
import { ok } from 'neverthrow'

const t1 = { type: 'iceCandidat' }
const t2 = { type: 'dupa' }
const t3 = { type: 'iceCandidate' }

describe('#', () => {
  it('the observable emits hello', () => {
    const observerSpy = subscribeSpyTo(message$)

    // messageSubject.next(JSON.stringify(t1));
    // messageSubject.next(JSON.stringify(t2));
    // messageSubject.next(JSON.stringify(t3));

    expect(observerSpy.getValues()).toEqual([ok(t1), ok(t2)])
  })
})
