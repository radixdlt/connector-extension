import { describe, expect, it, vi } from 'vitest'
import { BehaviorSubject, Subject } from 'rxjs'
import { errAsync, okAsync } from 'neverthrow'
import { config } from 'config'
import type { RetiredLink } from 'chrome/links/retired-links'
import {
  LinkRemovalNotices,
  type NoticeTransport,
} from './link-removal-notices'

const link = (password: string, retiredAt = 1_000): RetiredLink => ({
  password,
  walletPublicKey: password.repeat(32).slice(0, 64),
  walletName: `Wallet ${password}`,
  retiredAt,
})

const FakeTransport = () => {
  const connected = new BehaviorSubject(false)
  const messages = new Subject<Record<string, unknown>>()
  return {
    connected,
    messages,
    transport: {
      connected$: connected.asObservable(),
      onMessage$: messages.asObservable(),
      setConnectionPassword: vi.fn(() => okAsync(undefined)),
      setConnectionConfig: vi.fn(),
      sendMessage: vi.fn(() => okAsync(undefined)),
      connect: vi.fn(),
      destroy: vi.fn(),
    } satisfies Record<keyof NoticeTransport, unknown>,
  }
}

const setup = () => {
  const transports = new Map<string, ReturnType<typeof FakeTransport>>()
  const delivered: string[] = []
  const notices = LinkRemovalNotices({
    createTransport: (retired) => {
      const fake = FakeTransport()
      transports.set(retired.password, fake)
      return fake.transport as unknown as NoticeTransport
    },
    onDelivered: (retired) => delivered.push(retired.password),
    sendTimeoutMs: 1_000,
    now: () => 2_000,
  })
  return { notices, transports, delivered }
}

const none = new Set<string>()

describe('LinkRemovalNotices', () => {
  it('opens the forgotten link, and tells the wallet as soon as it connects', async () => {
    const { notices, transports, delivered } = setup()
    notices.setConnectionConfig({ transport: 'iroh' } as any)

    notices.update([link('aa')], none)
    const fake = transports.get('aa')!
    expect(fake.transport.setConnectionPassword).toHaveBeenCalledWith(
      Buffer.from('aa', 'hex'),
    )
    expect(fake.transport.setConnectionConfig).toHaveBeenCalledWith({
      transport: 'iroh',
    })
    expect(fake.transport.connect).toHaveBeenCalled()
    expect(fake.transport.sendMessage).not.toHaveBeenCalled()

    fake.connected.next(true)
    await Promise.resolve()

    expect(fake.transport.sendMessage).toHaveBeenCalledWith(
      { discriminator: 'linkRemoved' },
      { timeout: 1_000 },
    )
    expect(delivered).toEqual(['aa'])
  })

  it('sends it again on the next connection when it was not delivered', async () => {
    const { notices, transports, delivered } = setup()
    notices.update([link('aa')], none)
    const fake = transports.get('aa')!
    fake.transport.sendMessage.mockReturnValueOnce(
      errAsync({ reason: 'timeout' }) as any,
    )

    fake.connected.next(true)
    await Promise.resolve()
    expect(delivered).toEqual([])

    fake.connected.next(false)
    fake.connected.next(true)
    await Promise.resolve()
    expect(fake.transport.sendMessage).toHaveBeenCalledTimes(2)
    expect(delivered).toEqual(['aa'])
  })

  it('ends when the wallet removed the link too, and ignores anything else it sends', () => {
    const { notices, transports, delivered } = setup()
    notices.update([link('aa')], none)
    const fake = transports.get('aa')!

    fake.messages.next({ discriminator: 'accountList', accounts: [] })
    fake.messages.next({ interactionId: 'x', items: {} })
    expect(delivered).toEqual([])

    fake.messages.next({ discriminator: 'linkRemoved' })
    fake.messages.next({ discriminator: 'linkRemoved' })
    expect(delivered).toEqual(['aa'])
  })

  it('waits while the link is still open as a wallet link, and skips expired ones', () => {
    const { notices, transports } = setup()
    const expired = link('bb', 2_000 - config.links.removalNoticeLifetime)

    notices.update([link('aa'), expired], new Set(['aa']))
    expect(transports.size).toBe(0)

    notices.update([link('aa'), expired], none)
    expect([...transports.keys()]).toEqual(['aa'])
  })

  it('closes the link of a notice that is no longer wanted', () => {
    const { notices, transports } = setup()
    notices.update([link('aa'), link('cc')], none)

    notices.update([link('cc')], none)

    expect(transports.get('aa')!.transport.destroy).toHaveBeenCalled()
    expect(transports.get('cc')!.transport.destroy).not.toHaveBeenCalled()
    expect(notices.size()).toBe(1)
  })
})
