/**
 * What the extension knows of each link's wallet, by link (short wallet key): whether
 * the link is connected to it, whether its app is in the background (as it said), and
 * whether it reports the requests it holds (iroh).
 */
export const WalletPresence = () => {
  const connected = new Set<string>()
  const inBackground = new Set<string>()
  const reportsRequests = new Map<string, () => boolean>()

  return {
    setConnected: (link: string, isConnected: boolean) => {
      if (isConnected) connected.add(link)
      else connected.delete(link)
    },
    isConnected: (link: string) => connected.has(link),
    /** Whether one of `links` is connected to its wallet. */
    anyConnected: (links: Iterable<string>) =>
      [...links].some((link) => connected.has(link)),
    /** Returns whether it changed. */
    setInBackground: (link: string, isInBackground: boolean) => {
      if (inBackground.has(link) === isInBackground) return false
      if (isInBackground) inBackground.add(link)
      else inBackground.delete(link)
      return true
    },
    inBackground: (link: string) => inBackground.has(link),
    /** How to ask, when needed, whether `link`'s wallet reports its requests. */
    walletOf: (link: string, details: { reportsRequests: () => boolean }) => {
      reportsRequests.set(link, details.reportsRequests)
    },
    reportsRequests: (link: string | undefined) =>
      !!link && !!reportsRequests.get(link)?.(),
  }
}

export type WalletPresence = ReturnType<typeof WalletPresence>
