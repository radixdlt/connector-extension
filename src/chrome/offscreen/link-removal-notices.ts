import { Subscription, filter } from 'rxjs'
import type { AppLogger } from 'utils/logger'
import {
  activeRetiredLinks,
  type RetiredLink,
} from 'chrome/links/retired-links'
import { linkRemovedMessage } from 'ledger/schemas'
import type {
  CompositeTransport,
  TransportConnectionConfig,
} from './wallet-connection/transport/composite-transport'
import { shortWalletKey } from './wallet-connection/transport/diagnostics'

/** What a notice needs of a link's transport. */
export type NoticeTransport = Pick<
  CompositeTransport,
  | 'connected$'
  | 'onMessage$'
  | 'setConnectionPassword'
  | 'setConnectionConfig'
  | 'sendMessage'
  | 'connect'
  | 'destroy'
>

type Notice = {
  link: RetiredLink
  transport: NoticeTransport
  subscription: Subscription
  sending: boolean
  done: boolean
}

export type LinkRemovalNotices = ReturnType<typeof LinkRemovalNotices>

/**
 * Tells the wallets of forgotten links that the extension forgot them, so that
 * they delete their end too: each notice opens its link (with the forgotten link's
 * password), sends `linkRemoved` as soon as the wallet is connected, and once the
 * wallet confirmed it received it, `onDelivered`. If the wallet removed the link
 * too, its own `linkRemoved` ends the notice as well.
 *
 * A notice only delivers its message: nothing else the wallet sends over it is
 * handled (no dApp request, no account list). A link still open as a wallet's link
 * (same password, e.g. while it closes) gets no notice until it is closed: two
 * endpoints with the same keys would displace each other.
 */
export const LinkRemovalNotices = (input: {
  createTransport: (link: RetiredLink) => NoticeTransport
  onDelivered: (link: RetiredLink) => void
  sendTimeoutMs: number
  logger?: AppLogger
  now?: () => number
}) => {
  const { logger } = input
  const now = input.now ?? Date.now
  const notices = new Map<string, Notice>()
  let connectionConfig: TransportConnectionConfig | undefined

  const walletOf = (notice: Notice) =>
    shortWalletKey(notice.link.walletPublicKey)

  const finish = (notice: Notice, how: string) => {
    if (notice.done) return
    notice.done = true
    logger?.info(`link removal notice: ${how}`, { wallet: walletOf(notice) })
    input.onDelivered(notice.link)
  }

  const send = (notice: Notice) => {
    if (notice.sending || notice.done) return
    notice.sending = true
    notice.transport
      .sendMessage(linkRemovedMessage, { timeout: input.sendTimeoutMs })
      .match(
        () => finish(notice, 'the wallet received it'),
        (error) => {
          notice.sending = false
          // Sent again when the wallet connects next.
          logger?.info('link removal notice not delivered yet', {
            wallet: walletOf(notice),
            reason: error.reason,
          })
        },
      )
  }

  const start = (link: RetiredLink) => {
    const transport = input.createTransport(link)
    const notice: Notice = {
      link,
      transport,
      subscription: new Subscription(),
      sending: false,
      done: false,
    }
    notices.set(link.password, notice)
    notice.subscription.add(
      transport.connected$.pipe(filter(Boolean)).subscribe(() => send(notice)),
    )
    notice.subscription.add(
      transport.onMessage$.subscribe((message) => {
        if (message?.discriminator === linkRemovedMessage.discriminator)
          finish(notice, 'the wallet removed the link too')
        else
          logger?.debug(
            'link removal notice: ignored a message of the wallet',
            {
              wallet: walletOf(notice),
            },
          )
      }),
    )
    transport.setConnectionPassword(Buffer.from(link.password, 'hex')).mapErr(
      () =>
        logger?.warn('link removal notice: invalid password, not sent', {
          wallet: walletOf(notice),
        }),
    )
    if (connectionConfig) transport.setConnectionConfig(connectionConfig)
    transport.connect()
    logger?.info('link removal notice waiting for the wallet', {
      wallet: walletOf(notice),
    })
  }

  const stop = (password: string) => {
    const notice = notices.get(password)
    if (!notice) return
    notices.delete(password)
    notice.subscription.unsubscribe()
    notice.transport.destroy()
  }

  return {
    /**
     * The notices to deliver now: `links`, less the expired ones and those whose
     * password is still open as a wallet's link (`openPasswords`).
     */
    update: (links: RetiredLink[], openPasswords: ReadonlySet<string>) => {
      const wanted = new Map(
        activeRetiredLinks(links, now())
          .filter((link) => !openPasswords.has(link.password))
          .map((link) => [link.password, link]),
      )
      for (const password of [...notices.keys()])
        if (!wanted.has(password)) stop(password)
      for (const [password, link] of wanted)
        if (!notices.has(password)) start(link)
    },
    /** The transports and relays of the links, from the extension's options. */
    setConnectionConfig: (config: TransportConnectionConfig) => {
      connectionConfig = config
      for (const notice of notices.values())
        notice.transport.setConnectionConfig(config)
    },
    size: () => notices.size,
    destroy: () => {
      for (const password of [...notices.keys()]) stop(password)
    },
  }
}
