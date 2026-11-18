/**
 * The iroh sessions running in a page, by local endpoint id (a public key derived
 * from the link password; never logged in full). Two sessions with the same id hold
 * the same key and displace each other at the relay.
 */
export const EndpointRegistry = (holders = new Map<string, number>()) => ({
  /** Counts one more session of `endpointId`; returns how many there are now. */
  hold: (endpointId: string) => {
    const count = (holders.get(endpointId) ?? 0) + 1
    holders.set(endpointId, count)
    return count
  },
  /** Counts one session of `endpointId` less. */
  release: (endpointId: string) => {
    const count = (holders.get(endpointId) ?? 1) - 1
    if (count > 0) holders.set(endpointId, count)
    else holders.delete(endpointId)
  },
})

export type EndpointRegistry = ReturnType<typeof EndpointRegistry>

/** The sessions of this page (the offscreen document). */
export const pageEndpoints = EndpointRegistry()
