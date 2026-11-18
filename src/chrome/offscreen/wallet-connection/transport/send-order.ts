import type { TransportName } from './diagnostics'

/**
 * The transports to try, in order, for one message, among the `candidates` (selected
 * and created, in their slots' order): first a preferred one that is connected, unless
 * it is held back after a failure while another is connected; then the others, those
 * not preferred first.
 */
export const sendOrderOf = (
  candidates: TransportName[],
  {
    isConnected,
    isPreferred,
    heldBackForMs,
  }: {
    isConnected: (name: TransportName) => boolean
    isPreferred: (name: TransportName) => boolean
    heldBackForMs: (name: TransportName) => number
  },
): TransportName[] => {
  const goesFirst = (name: TransportName) =>
    isPreferred(name) &&
    isConnected(name) &&
    !(
      heldBackForMs(name) > 0 &&
      candidates.some((other) => other !== name && isConnected(other))
    )
  const first = candidates.filter(goesFirst)
  const others = candidates.filter((name) => !first.includes(name))
  return [
    ...first,
    ...others.filter((name) => !isPreferred(name)),
    ...others.filter((name) => isPreferred(name)),
  ]
}
