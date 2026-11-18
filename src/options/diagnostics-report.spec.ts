import { describe, it, expect } from 'vitest'
import type { WalletConnectionDiagnostics } from 'chrome/offscreen/wallet-connection/transport/diagnostics'
import {
  connectionSections,
  describeIrohRelay,
  formatDiagnosticsReport,
  formatDuration,
  formatTime,
  formatUtcOffset,
  notReported,
  outdatedBuildNotice,
  sendingVia,
  withoutTrailingHostDot,
} from './diagnostics-report'

// The times are local: the expected ones below are in UTC.
process.env.TZ = 'UTC'

const connections: WalletConnectionDiagnostics[] = [
  {
    walletName: 'Radix Wallet 1',
    walletKey: 'abcd1234',
    transport: 'webrtcAndIroh',
    connected: true,
    sendingVia: 'iroh',
    connects: { iroh: 3, webrtc: 1 },
    stats: {
      sent: { iroh: 4, webrtc: 1 },
      received: { iroh: 2, webrtc: 0 },
      fallbacks: 1,
      failed: 0,
      duplicatesDropped: 1,
    },
    pending: { dAppRequests: 2, ledgerResponses: 0 },
    recentEvents: [
      {
        at: Date.UTC(2026, 9, 30, 8),
        source: 'link',
        event: 'connected via iroh',
      },
      { at: Date.UTC(2026, 9, 30, 9), source: 'iroh', event: 'connected' },
      {
        at: Date.UTC(2026, 9, 30, 9, 30),
        source: 'iroh',
        event: 'disconnected: replaced by a newer connection from the peer',
        count: 2,
      },
    ],
    irohLibraryEvents: [
      {
        at: Date.UTC(2026, 9, 30, 9, 45),
        level: 'warn',
        target: 'radix_connect_iroh::session',
        message: 'another endpoint took over this link local=c0ffeec0ff',
        count: 3,
      },
    ],
    webRtc: {
      connected: false,
      signalingServer: 'wss://signaling.example.com',
      signalingConnected: true,
      peerConnectionState: 'failed',
      iceConnectionState: 'failed',
      lastError: { message: 'ICE failed', at: Date.UTC(2026, 9, 30, 10) },
    },
    iroh: {
      connected: true,
      relayUrlValid: true,
      startFailures: 0,
      session: {
        role: 'connector',
        publicRelays: true,
        relayUrl: 'https://relay.example.com./',
        relayConnected: true,
        state: 'connected',
        path: 'direct',
        rttMs: 42,
        failedAttempts: 0,
        connectedForMs: 125_000,
        summary:
          'connector c0ffeec0ff → beef00beef state=connected path=direct rtt=42ms',
      },
    },
  },
  {
    walletName: 'Radix Wallet 2',
    walletKey: 'ef567890',
    transport: 'iroh',
    connected: false,
    iroh: {
      connected: false,
      configuredRelayUrl: 'http://relay.example.com/',
      relayUrlValid: false,
      startFailures: 0,
      lastError: {
        message: 'invalid relay URL: http:// is only allowed locally',
        at: Date.UTC(2026, 9, 30, 11),
      },
    },
  },
]

const report = formatDiagnosticsReport({
  generatedAt: new Date(Date.UTC(2026, 9, 30, 12)),
  extensionVersion: '1.7.0',
  browser: 'Chrome test',
  connections,
  offscreen: { instance: '1a2b3c4d', build: 'abc1234-1', uptimeMs: 3_725_000 },
  irohLibraryEvents: [],
  pageBuild: 'abc1234-1',
})

const linesAfter = (text: string, heading: string) =>
  text.slice(text.indexOf(heading)).split('\n')

describe('diagnostics report', () => {
  it('has a header and one section per linked wallet', () => {
    expect(report).toContain(
      'Generated: 2026-10-30 12:00:00.000 (UTC+00:00; 2026-10-30T12:00:00.000Z)',
    )
    expect(report).toContain('Extension: 1.7.0')
    expect(report).toContain('Linked wallets: 2')
    expect(report).toContain(
      'Offscreen document: 1a2b3c4d, build abc1234-1, running for 1 h 2 min (3725000 ms)',
    )
    expect(report).toContain('\nWallet abcd1234\n')
    expect(report).toContain('\nWallet ef567890\n')
    // Names are chosen by users: the report, which they share, does not have them.
    expect(report).not.toContain('Radix Wallet 1')
    expect(report).not.toContain(outdatedBuildNotice)
  })

  it('splits each wallet into the link, then iroh and WebRTC', () => {
    expect(linesAfter(report, 'Wallet abcd1234').slice(0, 30)).toEqual([
      'Wallet abcd1234',
      '  Wallet: abcd1234',
      '  Transport: WebRTC and iroh (webrtcAndIroh)',
      '  Connected via: iroh',
      '  Sending via: iroh',
      '  Pending: 2 dApp requests, 0 ledger responses',
      '  Messages: 1 sent after a fallback, 0 failed, 1 duplicates dropped',
      '  Recent events:',
      '    2026-10-30 08:00:00.000 connected via iroh',
      '  iroh:',
      '    State: connected',
      '    Path: direct',
      '    RTT: 42 ms',
      '    Relay: public (relay https://relay.example.com/), connected',
      '    Connected for: 2 min 5 s',
      '    Failed attempts: 0 (failed starts: 0)',
      '    Last error: none',
      '    Connections: 3 (2 reconnections)',
      '    Messages: sent 4, received 2',
      '    Recent events:',
      '      2026-10-30 09:00:00.000 connected',
      '      2026-10-30 09:30:00.000 disconnected: replaced by a newer connection from the peer (x2)',
      '    iroh library warnings about this link:',
      '      2026-10-30 09:45:00.000 WARN radix_connect_iroh::session: another endpoint took over this link local=c0ffeec0ff (x3)',
      '  WebRTC:',
      '    State: not connected',
      '    Signaling: wss://signaling.example.com (connected)',
      '    Peer connection: failed, ICE failed',
      '    Last error: ICE failed (2026-10-30 10:00:00.000)',
      '    Connections: 1',
    ])
    expect(report).toContain('iroh library warnings and errors: none')
  })

  it('explains a link that cannot connect, and skips the transport it does not use', () => {
    const lines = linesAfter(report, 'Wallet ef567890')
    expect(lines).toContain('  Connected via: none')
    expect(lines).toContain('  Sending via: none (not connected)')
    expect(lines).toContain('    Relay: custom, INVALID URL: not connecting')
    expect(lines).toContain(
      '    Last error: invalid relay URL: http:// is only allowed locally (2026-10-30 11:00:00.000)',
    )
    expect(lines).toContain('  WebRTC: not used in this mode')
  })

  it('leaves out what the running version does not report', () => {
    // Wallet ef567890 has neither pending counts, nor message counts.
    const lines = linesAfter(report, 'Wallet ef567890')
    expect(lines.some((line) => line.includes('Pending'))).toBe(false)
    expect(lines.some((line) => line.includes('Messages'))).toBe(false)
    expect(report).not.toContain('unknown')
  })

  it('warns when the offscreen document runs a previous build, and says what it lacks', () => {
    for (const offscreen of [
      { instance: '1a2b3c4d', build: 'old', uptimeMs: 1_000 },
      { instance: '1a2b3c4d', uptimeMs: 1_000 },
      undefined,
    ]) {
      const outdated = formatDiagnosticsReport({
        generatedAt: new Date(0),
        extensionVersion: '1.7.0',
        browser: 'Chrome test',
        connections: [connections[1]],
        offscreen,
        pageBuild: 'abc1234-1',
      })
      expect(outdated.split('\n')[1]).toBe(`NOTE: ${outdatedBuildNotice}`)
      expect(outdated).toContain(`  Pending: ${notReported}`)
      expect(outdated).toContain(`    Connections: ${notReported}`)
    }
  })

  it('says when iroh is held back after a failed send', () => {
    expect(
      sendingVia({
        ...connections[0],
        sendingVia: 'webrtc',
        irohHeldBackForMs: 12_000,
      }),
    ).toBe('WebRTC (iroh held back for 12 s after a failed send)')
    expect(sendingVia({ ...connections[0], sendingVia: undefined })).toBe(
      undefined,
    )
  })

  it('shows a key collision only when there is one', () => {
    const colliding = {
      ...connections[0],
      iroh: {
        ...connections[0].iroh!,
        session: { ...connections[0].iroh!.session!, keyCollision: true },
      },
    }
    const { transports } = connectionSections(colliding)
    expect(transports[0].rows).toContainEqual({
      label: 'Key collision',
      value:
        "yes: another device or browser profile with this link took this connector's place on the relay",
    })
    expect(
      connectionSections(connections[0]).transports[0].rows.map(
        (row) => row.label,
      ),
    ).not.toContain('Key collision')
  })

  it('formats durations', () => {
    expect(formatDuration(4_400)).toBe('4 s')
    expect(formatDuration(125_000)).toBe('2 min 5 s')
    expect(formatDuration(3_720_000)).toBe('1 h 2 min')
  })

  it("tells n0's public relays from a custom relay", () => {
    const session = connections[0].iroh!.session!
    expect(
      describeIrohRelay({
        connected: false,
        relayUrlValid: true,
        startFailures: 0,
      }),
    ).toBe('public (no relay yet), NOT connected')
    expect(
      describeIrohRelay({
        connected: true,
        configuredRelayUrl: 'https://relay.example.org/',
        relayUrlValid: true,
        startFailures: 0,
        session: {
          ...session,
          publicRelays: false,
          relayUrl: 'https://relay.example.org/',
          relayError: 'handshake failed',
        },
      }),
    ).toBe(
      'custom https://relay.example.org/, connected, relay error: handshake failed',
    )
  })

  it('shows times in local time, and says which zone', () => {
    const at = Date.UTC(2026, 10, 1, 16, 14, 3, 345)
    process.env.TZ = 'Europe/Madrid'
    try {
      expect(formatTime(at)).toBe('2026-11-01 17:14:03.345')
      expect(formatUtcOffset(at)).toBe('UTC+01:00')
    } finally {
      process.env.TZ = 'UTC'
    }
  })

  it('drops the final dot of an absolute relay host name', () => {
    expect(withoutTrailingHostDot('https://euc1-1.relay.n0.iroh.link./')).toBe(
      'https://euc1-1.relay.n0.iroh.link/',
    )
    expect(withoutTrailingHostDot('https://relay.example.com.:443/a')).toBe(
      'https://relay.example.com:443/a',
    )
    expect(withoutTrailingHostDot('https://relay.example.com/a.')).toBe(
      'https://relay.example.com/a.',
    )
  })
})
