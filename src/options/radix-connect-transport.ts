import * as v from 'valibot'
import { err, ok, type Result } from 'neverthrow'

/**
 * Transports Radix Connect uses to reach linked wallets:
 * - `webrtc`: WebRTC data channel through the signaling server (default),
 * - `iroh`: QUIC through an iroh relay server,
 * - `webrtcAndIroh`: both; messages go through iroh while it is connected.
 */
export const radixConnectTransports = [
  'webrtc',
  'iroh',
  'webrtcAndIroh',
] as const

export type RadixConnectTransport = (typeof radixConnectTransports)[number]

export const defaultRadixConnectTransport: RadixConnectTransport = 'webrtc'

const RadixConnectTransportSchema = v.picklist(radixConnectTransports)

/** Options come from storage: anything unknown falls back to the default. */
export const parseRadixConnectTransport = (
  value: unknown,
): RadixConnectTransport =>
  v.is(RadixConnectTransportSchema, value)
    ? value
    : defaultRadixConnectTransport

export const usesWebRtc = (transport: RadixConnectTransport) =>
  transport === 'webrtc' || transport === 'webrtcAndIroh'

export const usesIroh = (transport: RadixConnectTransport) =>
  transport === 'iroh' || transport === 'webrtcAndIroh'

const isPrivateIpv4 = (hostname: string) => {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname)
  if (!match) return false
  const [a, b] = [Number(match[1]), Number(match[2])]
  return (
    a === 127 || // loopback
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) // link-local
  )
}

// URL serializes IPv6 hosts in brackets, compressed, without leading zeros: a
// first group of 4 digits is the only form these prefixes can take.
const isPrivateIpv6 = (hostname: string) => {
  if (!hostname.startsWith('[') || !hostname.endsWith(']')) return false
  const address = hostname.slice(1, -1)
  return (
    address === '::1' || // loopback
    /^f[cd][0-9a-f]{2}:/.test(address) || // unique local, fc00::/7
    /^fe[89ab][0-9a-f]:/.test(address) // link-local, fe80::/10
  )
}

/**
 * Hosts on the developer's machine or local network, as the iroh library defines
 * them: `localhost`, and loopback, private and link-local addresses.
 */
export const isLocalNetworkHost = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    isPrivateIpv4(host) ||
    isPrivateIpv6(host)
  )
}

/**
 * Validates the iroh relay URL option. Empty means n0's public relays
 * (`undefined`): each end uses its closest one. Otherwise the relay must be an `https://` URL; plain `http://` is
 * accepted only for a relay on localhost or the local network (development).
 * Returns the normalized URL or a message for the user.
 */
export const parseIrohRelayUrl = (
  input: string | undefined,
): Result<string | undefined, string> => {
  const value = (input ?? '').trim()
  if (!value) return ok(undefined)

  let url: URL
  try {
    url = new URL(value)
  } catch (error) {
    return err('Enter an absolute URL, e.g. https://relay.example.com')
  }

  if (url.username || url.password)
    return err('The URL must not contain credentials')
  if (url.search || url.hash)
    return err('The URL must not contain a query or a fragment')
  if (!url.hostname) return err('The URL has no host')

  if (url.protocol === 'https:') return ok(url.href)
  if (url.protocol === 'http:')
    return isLocalNetworkHost(url.hostname)
      ? ok(url.href)
      : err('http:// is only allowed for a relay on this machine or network')
  return err('The URL must start with https://')
}
