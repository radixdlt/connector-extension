import { describe, expect, it, vi } from 'vitest'
import { settleOrTimeout, settleWithin } from './settle'
import { EndpointRegistry } from './endpoint-registry'
import { parseIncoming, serialize, toSendMessageError } from './iroh-wire'
import { ManagedSession } from './managed-session'
import type { IrohSession } from './iroh-bindings'

const never = new Promise<never>(() => {})

describe('settle', () => {
  it('settleWithin resolves with the value, or undefined when late or failed', async () => {
    expect(await settleWithin(Promise.resolve(1), 50)).toBe(1)
    expect(await settleWithin(never, 5)).toBeUndefined()
    expect(await settleWithin(Promise.reject(new Error('x')), 50)).toBe(
      undefined,
    )
  })

  it('settleOrTimeout rejects with a timeout code when the promise is late', async () => {
    expect(await settleOrTimeout(Promise.resolve(2), 50)).toBe(2)
    await expect(settleOrTimeout(never, 5)).rejects.toMatchObject({
      code: 'timeout',
    })
  })
})

describe('EndpointRegistry', () => {
  it('counts the sessions of each endpoint, and forgets one with none left', () => {
    const holders = new Map<string, number>()
    const registry = EndpointRegistry(holders)

    expect(registry.hold('a')).toBe(1)
    expect(registry.hold('a')).toBe(2)
    registry.release('a')
    expect(holders.get('a')).toBe(1)
    registry.release('a')
    expect(holders.has('a')).toBe(false)
  })
})

describe('iroh wire', () => {
  it('reads only JSON objects from the wallet', () => {
    expect(parseIncoming('{"a":1}')._unsafeUnwrap()).toEqual({ a: 1 })
    expect(parseIncoming('{')._unsafeUnwrapErr()).toBe('not valid JSON')
    expect(parseIncoming('[1]')._unsafeUnwrapErr()).toBe('not a JSON object')
    expect(parseIncoming('null')._unsafeUnwrapErr()).toBe('not a JSON object')
  })

  it('serializes messages, and fails to prepare what JSON cannot hold', () => {
    expect(serialize({ a: 1 })._unsafeUnwrap()).toBe('{"a":1}')
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(serialize(circular)._unsafeUnwrapErr().reason).toBe(
      'failedToPrepareMessage',
    )
  })

  it('maps session errors to send errors by whether anything was sent', () => {
    const withCode = (code: string) => Object.assign(new Error(code), { code })
    expect(toSendMessageError(withCode('notConnected')).reason).toBe(
      'notConnected',
    )
    expect(toSendMessageError(withCode('timeout')).reason).toBe('timeout')
    expect(toSendMessageError(new Error('unknown')).reason).toBe(
      'failedToSendMessage',
    )
  })
})

describe('ManagedSession', () => {
  const fakeSession = (overrides: Partial<IrohSession> = {}) =>
    ({
      state: () => 'connected',
      send: vi.fn(() => Promise.resolve()),
      nextEvent: () => never,
      shutdown: vi.fn(() => Promise.resolve()),
      free: vi.fn(),
      diagnostics: () => ({}),
      ...overrides,
    }) as unknown as IrohSession

  it('ends nextEvent at shutdown, even while the session call is pending', async () => {
    const session = ManagedSession(fakeSession(), { shutdownTimeoutMs: 50 })
    const event = session.nextEvent()

    await session.shutdown()

    expect(await event).toBeUndefined()
    expect(await session.nextEvent()).toBeUndefined()
  })

  it('does not wait longer than the shutdown timeout, then frees the session', async () => {
    const raw = fakeSession({ shutdown: vi.fn(() => never) })
    const session = ManagedSession(raw, { shutdownTimeoutMs: 5 })

    await session.close()

    expect(raw.free).toHaveBeenCalled()
  })

  it('reports a session that throws as not connected', () => {
    const session = ManagedSession(
      fakeSession({
        state: () => {
          throw new Error('freed')
        },
      }),
      { shutdownTimeoutMs: 5 },
    )
    expect(session.isConnected()).toBe(false)
  })
})
