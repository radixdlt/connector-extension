import { config } from 'config'
import { updateLocalStore } from 'chrome/helpers/storage'
import type { Connection } from 'pairing/state/connections'

/**
 * A link the extension forgot, whose wallet must still be told: the extension
 * keeps its password only to deliver that notice (`linkRemoved`), then forgets
 * it. Never used for dApp requests.
 */
export type RetiredLink = {
  /** The link's connection password (hex): it opens the link, and identifies it. */
  password: string
  walletPublicKey: string
  walletName: string
  /** When the extension forgot it (milliseconds since the epoch). */
  retiredAt: number
}

/** Whether the notice is too old to keep its password any longer. */
export const isExpired = (link: RetiredLink, now = Date.now()) =>
  now - link.retiredAt >= config.links.removalNoticeLifetime

/** The notices still to deliver: not expired. */
export const activeRetiredLinks = (
  links: RetiredLink[] | undefined,
  now = Date.now(),
) => (links ?? []).filter((link) => !isExpired(link, now))

/** Keeps a notice for the wallet of `connection`, which the extension forgets. */
export const retireLink = (connection: Connection, at = Date.now()) =>
  updateLocalStore('retiredLinks', [], (links) => [
    ...links.filter((link) => link.password !== connection.password),
    {
      password: connection.password,
      walletPublicKey: connection.walletPublicKey,
      walletName: connection.walletName,
      retiredAt: at,
    },
  ])

/** The notice was delivered (or is no longer needed): its password is forgotten. */
export const forgetRetiredLink = (password: string) =>
  updateLocalStore('retiredLinks', [], (links) =>
    links.filter((link) => link.password !== password),
  )

/** Forgets the passwords of the notices that expired. */
export const pruneRetiredLinks = (now = Date.now()) =>
  updateLocalStore('retiredLinks', [], (links) =>
    activeRetiredLinks(links, now),
  )
