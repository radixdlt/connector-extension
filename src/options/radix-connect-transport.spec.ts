import { describe, it, expect } from 'vitest'
import { getTransportConfig } from 'config'
import { defaultConnectorExtensionOptions, getExtensionOptions } from 'options'
import { vi } from 'vitest'
import {
  migrateIrohRelayUrl,
  isLocalNetworkHost,
  parseIrohRelayUrl,
  parseRadixConnectTransport,
  usesIroh,
  usesWebRtc,
} from './radix-connect-transport'

describe('radixConnectTransport option', () => {
  it('defaults to WebRTC', () => {
    expect(defaultConnectorExtensionOptions.radixConnectTransport).toBe(
      'webrtc',
    )
  })

  it.each(['webrtc', 'iroh', 'webrtcAndIroh'])('accepts %s', (value) => {
    expect(parseRadixConnectTransport(value)).toBe(value)
  })

  it.each([undefined, null, '', 'IROH', 'quic', 1, {}])(
    'falls back to WebRTC for %s',
    (value) => {
      expect(parseRadixConnectTransport(value)).toBe('webrtc')
    },
  )

  it('tells which transports a mode uses', () => {
    expect([usesWebRtc('webrtc'), usesIroh('webrtc')]).toEqual([true, false])
    expect([usesWebRtc('iroh'), usesIroh('iroh')]).toEqual([false, true])
    expect([usesWebRtc('webrtcAndIroh'), usesIroh('webrtcAndIroh')]).toEqual([
      true,
      true,
    ])
  })
})

describe('parseIrohRelayUrl', () => {
  it.each([undefined, '', '   '])('uses the default relay for %j', (value) => {
    expect(parseIrohRelayUrl(value)._unsafeUnwrap()).toBeUndefined()
  })

  it.each([
    ['https://relay.example.com', 'https://relay.example.com/'],
    ['  https://relay.example.com:8443/  ', 'https://relay.example.com:8443/'],
    [
      'https://euc1-1.relay.n0.iroh.link./',
      'https://euc1-1.relay.n0.iroh.link./',
    ],
    ['http://localhost:3340', 'http://localhost:3340/'],
    ['http://127.0.0.1:3340', 'http://127.0.0.1:3340/'],
    ['http://192.168.1.20:3340', 'http://192.168.1.20:3340/'],
    ['http://10.0.0.2', 'http://10.0.0.2/'],
    ['http://172.20.0.5', 'http://172.20.0.5/'],
    ['http://169.254.1.2', 'http://169.254.1.2/'],
    ['http://[::1]:3340', 'http://[::1]:3340/'],
    ['http://[fd00::1]', 'http://[fd00::1]/'],
    ['http://[fe80::1]:3340', 'http://[fe80::1]:3340/'],
  ])('accepts %s', (value, normalized) => {
    expect(parseIrohRelayUrl(value)._unsafeUnwrap()).toBe(normalized)
  })

  it.each([
    'relay.example.com',
    'wss://relay.example.com',
    'ftp://relay.example.com',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'http://relay.example.com',
    'http://8.8.8.8',
    'http://172.32.0.1',
    'http://[2001:db8::1]',
    'http://localhost.example.com',
    'http://relay.local:3340',
    'http://[fd::1]',
    'http://[fe8::1]',
    'http://[::ffff:127.0.0.1]',
    'https://user:secret@relay.example.com',
    'https://user@relay.example.com',
    'https://relay.example.com/?token=1',
    'https://relay.example.com/#fragment',
  ])('rejects %s', (value) => {
    expect(parseIrohRelayUrl(value).isErr()).toBe(true)
  })

  it('recognizes hosts on the local network', () => {
    expect(isLocalNetworkHost('LOCALHOST')).toBe(true)
    expect(isLocalNetworkHost('dev.localhost')).toBe(true)
    expect(isLocalNetworkHost('169.254.10.1')).toBe(true)
    expect(isLocalNetworkHost('[fe80::1]')).toBe(true)
    expect(isLocalNetworkHost('example.com')).toBe(false)
    expect(isLocalNetworkHost('192.169.0.1')).toBe(false)
  })
})

describe('getTransportConfig', () => {
  it('uses WebRTC only for options saved before the transport option existed', () => {
    const legacyOptions: Partial<typeof defaultConnectorExtensionOptions> = {
      ...defaultConnectorExtensionOptions,
    }
    delete legacyOptions.radixConnectTransport

    const transportConfig = getTransportConfig(
      legacyOptions as typeof defaultConnectorExtensionOptions,
    )

    expect(transportConfig.transport).toBe('webrtc')
    expect(transportConfig.iroh).toEqual({ relayUrl: undefined })
    expect(transportConfig.webRtc.signalingServerBaseUrl).toBeTruthy()
  })

  it('always uses WebRTC in builds without iroh', () => {
    const transportConfig = getTransportConfig(
      {
        ...defaultConnectorExtensionOptions,
        radixConnectTransport: 'iroh',
        irohRelayUrl: 'https://relay.example.com',
      },
      false,
    )

    expect(transportConfig.transport).toBe('webrtc')
  })

  it('passes the selected transport and the relay URL', () => {
    const transportConfig = getTransportConfig({
      ...defaultConnectorExtensionOptions,
      radixConnectTransport: 'webrtcAndIroh',
      irohRelayUrl: ' https://relay.example.com ',
    })

    expect(transportConfig.transport).toBe('webrtcAndIroh')
    expect(transportConfig.iroh).toEqual({
      relayUrl: 'https://relay.example.com',
    })
  })
})

describe('migrateIrohRelayUrl', () => {
  it.each([
    'https://euc1-1.relay.n0.iroh.link./',
    ' https://euc1-1.relay.n0.iroh.link. ',
    'https://euc1-1.relay.n0.iroh.link/',
    'https://EUC1-1.relay.n0.iroh.link./',
  ])("turns the old default relay %j into n0's public relays", (value) => {
    expect(migrateIrohRelayUrl(value)).toBe('')
  })

  it.each([
    ['https://relay.example.com/', 'https://relay.example.com/'],
    [
      'https://euc1-1.relay.n0.iroh.link:8443/',
      'https://euc1-1.relay.n0.iroh.link:8443/',
    ],
    [
      'https://use1-1.relay.n0.iroh.link./',
      'https://use1-1.relay.n0.iroh.link./',
    ],
    ['not a url', 'not a url'],
    [undefined, ''],
  ])('keeps %j', (value, expected) => {
    expect(migrateIrohRelayUrl(value)).toBe(expected)
  })

  it('applies to stored options and to the transport configuration', async () => {
    const stored = {
      ...defaultConnectorExtensionOptions,
      radixConnectTransport: 'iroh' as const,
      irohRelayUrl: 'https://euc1-1.relay.n0.iroh.link./',
    }
    vi.mocked(chrome.storage.local.get).mockImplementation((() =>
      Promise.resolve({ options: stored })) as any)

    const options = (await getExtensionOptions())._unsafeUnwrap()

    expect(options.irohRelayUrl).toBe('')
    expect(getTransportConfig(stored, true).iroh).toEqual({
      relayUrl: undefined,
    })
  })
})
