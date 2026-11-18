/**
 * How the main view orders the linked wallets. `custom` is the order the user
 * arranged (dragging the cards, or Move up/down in their menu); the other sorts
 * fall back to it to order wallets they rank the same.
 */
export const walletSorts = [
  'custom',
  'name',
  'recentlyLinked',
  'recentlyUsed',
  'connected',
] as const

export type WalletSort = (typeof walletSorts)[number]

export const defaultWalletSort: WalletSort = 'custom'

/** When a wallet was linked, and when it last answered a dApp (milliseconds). */
export type WalletActivity = { linkedAt?: number; lastUsedAt?: number }

/**
 * `entries` (wallet public key and connection, in the order they were linked)
 * sorted by `sort`. Wallets missing from `order` come after the ones in it, in
 * the order they were linked.
 */
export const sortWallets = <T extends { walletName: string }>(
  entries: [string, T][],
  {
    sort,
    order = [],
    activity = {},
    isConnected = () => false,
  }: {
    sort: WalletSort
    order?: string[]
    activity?: Record<string, WalletActivity>
    isConnected?: (walletPublicKey: string) => boolean
  },
): [string, T][] => {
  const linkedIndex = new Map(entries.map(([id], index) => [id, index]))
  const customPosition = (id: string) => {
    const position = order.indexOf(id)
    return position < 0 ? order.length + linkedIndex.get(id)! : position
  }
  const byCustom = (a: string, b: string) =>
    customPosition(a) - customPosition(b)
  // Wallets linked before link times were kept: older than any with a time, in
  // the order they were linked.
  const linkedAt = (id: string) =>
    activity[id]?.linkedAt ?? linkedIndex.get(id)! - entries.length
  const lastUsedAt = (id: string) => activity[id]?.lastUsedAt ?? -Infinity
  const names = new Intl.Collator(undefined, {
    sensitivity: 'base',
    numeric: true,
  })

  const compare: Record<
    WalletSort,
    (a: [string, T], b: [string, T]) => number
  > = {
    custom: ([a], [b]) => byCustom(a, b),
    name: ([a, wa], [b, wb]) =>
      names.compare(wa.walletName, wb.walletName) || byCustom(a, b),
    recentlyLinked: ([a], [b]) => linkedAt(b) - linkedAt(a) || byCustom(a, b),
    recentlyUsed: ([a], [b]) =>
      lastUsedAt(b) - lastUsedAt(a) ||
      // Both never used.
      (lastUsedAt(a) === lastUsedAt(b) ? byCustom(a, b) : 0),
    connected: ([a], [b]) =>
      Number(isConnected(b)) - Number(isConnected(a)) || byCustom(a, b),
  }
  return [...entries].sort(compare[sort])
}

/** `ids` with the wallet at `from` moved to `to`: the new custom order. */
export const moveWallet = (ids: string[], from: number, to: number) => {
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved)
  return next
}
