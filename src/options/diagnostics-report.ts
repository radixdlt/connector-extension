import type { RadixConnectTransport } from './radix-connect-transport'
import type {
  IrohTransportDiagnostics,
  OffscreenDiagnostics,
  TransportError,
  TransportName,
  WalletConnectionDiagnostics,
  WebRtcDiagnostics,
} from 'chrome/offscreen/wallet-connection/transport/diagnostics'
import type {
  TransportEvent,
  TransportEventSource,
} from 'chrome/offscreen/wallet-connection/transport/transport-events'
import type { IrohLibraryEvent } from 'chrome/offscreen/wallet-connection/transport/iroh/iroh-library-log'

// What the "Connection diagnostics" panel, the report users copy into bug reports
// and the header of exported logs say, built once (`connectionSections`) for all
// three, from the diagnostics; the reports name wallets by their short key, not by
// the name users gave them.

/** Names of the transport modes (a transport's name is the mode using it alone). */
export const transportLabels: Record<RadixConnectTransport, string> = {
  webrtc: 'WebRTC',
  iroh: 'iroh',
  webrtcAndIroh: 'WebRTC and iroh',
}

const transportLabel = (name: TransportName) => transportLabels[name]

export const formatDuration = (ms: number) => {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

const pad = (value: number, length = 2) => String(value).padStart(length, '0')

/**
 * In local time, as the rest of the extension shows times, e.g.
 * "2026-11-01 17:14:03.345". The report says which zone that is.
 */
export const formatTime = (at: number) => {
  const date = new Date(at)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}.${pad(date.getMilliseconds(), 3)}`
}

/** e.g. "UTC+01:00", for the local times of a report. */
export const formatUtcOffset = (at: number) => {
  const offset = -new Date(at).getTimezoneOffset()
  const sign = offset < 0 ? '-' : '+'
  const minutes = Math.abs(offset)
  return `UTC${sign}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

/**
 * A URL as shown to people: iroh gives relay URLs with the absolute DNS name, e.g.
 * "https://euc1-1.relay.n0.iroh.link./", whose final dot reads as a typo.
 */
export const withoutTrailingHostDot = (url: string) =>
  url.replace(/(:\/\/[^/?#:]+)\.(?=[/?#:]|$)/, '$1')

export const formatError = (error?: TransportError) =>
  error ? `${error.message} (${formatTime(error.at)})` : 'none'

/** Shown when the offscreen document runs another build than this page. */
export const outdatedBuildNotice =
  'The extension was updated but is still running the previous version: reload it in chrome://extensions to see current diagnostics'

/** For a value an older offscreen document does not report. */
export const notReported = 'not reported by the running version'

/**
 * The offscreen document (which holds the links) runs another build than this
 * page: an unpacked extension rebuilt but not reloaded.
 */
export const isOutdatedBuild = (
  offscreen: OffscreenDiagnostics | undefined,
  pageBuild: string,
) => !offscreen?.build || offscreen.build !== pageBuild

/** Which selected transports are connected, e.g. "iroh", "WebRTC, iroh", "none". */
export const connectedVia = (connection: WalletConnectionDiagnostics) => {
  const via = [
    connection.webRtc?.connected && 'WebRTC',
    connection.iroh?.connected && 'iroh',
  ].filter(Boolean)
  return via.length ? via.join(', ') : 'none'
}

/**
 * e.g. "iroh", "WebRTC (iroh held back for 12 s after a failed send)", "none (not
 * connected)"; `undefined` when the running version does not say.
 */
export const sendingVia = (connection: WalletConnectionDiagnostics) => {
  if (!connection.sendingVia)
    return connection.connected ? undefined : 'none (not connected)'
  const label = transportLabel(connection.sendingVia)
  return connection.irohHeldBackForMs
    ? `${label} (iroh held back for ${formatDuration(
        connection.irohHeldBackForMs,
      )} after a failed send)`
    : label
}

/** e.g. "3 (2 reconnections)". */
const describeConnects = (count: number) =>
  `${count}${
    count > 1 ? ` (${count - 1} reconnection${count > 2 ? 's' : ''})` : ''
  }`

export const describePending = (connection: WalletConnectionDiagnostics) =>
  connection.pending
    ? `${connection.pending.dAppRequests} dApp requests, ${connection.pending.ledgerResponses} ledger responses`
    : undefined

export const describeEvent = (event: TransportEvent) =>
  `${formatTime(event.at)} ${event.event}${
    event.count ? ` (x${event.count})` : ''
  }`

export const describeLibraryEvent = (event: IrohLibraryEvent) =>
  `${formatTime(event.at)} ${event.level.toUpperCase()} ${event.target}: ${
    event.message
  }${event.count > 1 ? ` (x${event.count})` : ''}`

/**
 * The relay iroh uses, e.g. "public (relay https://…), connected" with n0's public
 * relays, or "custom https://…, NOT connected".
 */
export const describeIrohRelay = (iroh: IrohTransportDiagnostics) => {
  if (!iroh.relayUrlValid) return 'custom, INVALID URL: not connecting'
  const session = iroh.session
  const relay = iroh.configuredRelayUrl
    ? `custom ${iroh.configuredRelayUrl}`
    : `public (${
        session?.relayUrl
          ? `relay ${withoutTrailingHostDot(session.relayUrl)}`
          : 'no relay yet'
      })`
  return `${relay}, ${session?.relayConnected ? 'connected' : 'NOT connected'}${
    session?.relayError ? `, relay error: ${session.relayError}` : ''
  }`
}

/** How long iroh has been connected: the session's own figure, else the adapter's. */
export const irohConnectedForMs = (iroh: IrohTransportDiagnostics) =>
  iroh.connected
    ? iroh.session?.connectedForMs ?? iroh.connectedForMs
    : undefined

export type DiagnosticsRow = { label: string; value: string }

export type DiagnosticsSection = {
  /** `undefined`: the link as a whole. */
  title?: string
  rows: DiagnosticsRow[]
  events: string[]
  /** iroh library warnings that name this link. */
  libraryEvents?: string[]
}

export type ConnectionSections = {
  general: DiagnosticsSection
  /** The transports of the link's mode, in that order: iroh, WebRTC. */
  transports: DiagnosticsSection[]
  /** e.g. "WebRTC: not used in this mode". */
  unused: string[]
}

type Entry = [label: string, value: string | undefined]

/** What the sections are built with, for one link. */
const SectionTools = (
  connection: WalletConnectionDiagnostics,
  outdated: boolean,
) => {
  const stats = connection.stats
  return {
    /** Values every current version reports: "not reported" when outdated. */
    rows: (...entries: Entry[]) =>
      entries.flatMap(([label, value]): DiagnosticsRow[] => {
        if (value !== undefined) return [{ label, value }]
        return outdated ? [{ label, value: notReported }] : []
      }),
    /** Values that only exist in some states (e.g. a path while connected). */
    whenKnown: (...entries: Entry[]) =>
      entries.flatMap(([label, value]): DiagnosticsRow[] =>
        value !== undefined ? [{ label, value }] : [],
      ),
    eventsOf: (source: TransportEventSource) =>
      (connection.recentEvents ?? [])
        .filter((event) => event.source === source)
        .map(describeEvent),
    messagesVia: (name: TransportName) =>
      stats
        ? `sent ${stats.sent[name]}, received ${stats.received[name]}`
        : undefined,
    connectsOf: (name: TransportName) =>
      connection.connects
        ? describeConnects(connection.connects[name])
        : undefined,
  }
}

type SectionTools = ReturnType<typeof SectionTools>

const generalSection = (
  connection: WalletConnectionDiagnostics,
  tools: SectionTools,
): DiagnosticsSection => {
  const stats = connection.stats
  return {
    rows: tools.rows(
      ['Wallet', connection.walletKey],
      [
        'Transport',
        connection.transport
          ? `${transportLabels[connection.transport]} (${connection.transport})`
          : 'not configured yet',
      ],
      ['Connected via', connectedVia(connection)],
      ['Sending via', sendingVia(connection)],
      ['Pending', describePending(connection)],
      [
        'Messages',
        stats
          ? `${stats.fallbacks} sent after a fallback, ${stats.failed} failed, ${stats.duplicatesDropped} duplicates dropped`
          : undefined,
      ],
    ),
    events: tools.eventsOf('link'),
  }
}

const irohSection = (
  connection: WalletConnectionDiagnostics,
  iroh: IrohTransportDiagnostics,
  tools: SectionTools,
): DiagnosticsSection => {
  const session = iroh.session
  const connectedForMs = irohConnectedForMs(iroh)
  return {
    title: 'iroh',
    rows: [
      ...tools.whenKnown(
        [
          'State',
          session?.state ?? (iroh.connected ? 'connected' : 'no session'),
        ],
        ['Path', session?.path],
        [
          'RTT',
          session?.rttMs !== undefined ? `${session.rttMs} ms` : undefined,
        ],
        ['Relay', describeIrohRelay(iroh)],
        [
          'Connected for',
          connectedForMs !== undefined
            ? formatDuration(connectedForMs)
            : undefined,
        ],
        [
          'Failed attempts',
          `${session?.failedAttempts ?? 0} (failed starts: ${
            iroh.startFailures
          })`,
        ],
        [
          'Last error',
          session?.lastError ??
            (iroh.lastError ? formatError(iroh.lastError) : 'none'),
        ],
        [
          'Key collision',
          session?.keyCollision
            ? "yes: another device or browser profile with this link took this connector's place on the relay"
            : undefined,
        ],
      ),
      ...tools.rows(
        ['Connections', tools.connectsOf('iroh')],
        ['Messages', tools.messagesVia('iroh')],
      ),
    ],
    events: tools.eventsOf('iroh'),
    libraryEvents: (connection.irohLibraryEvents ?? []).map(
      describeLibraryEvent,
    ),
  }
}

const webRtcSection = (
  webRtc: WebRtcDiagnostics,
  tools: SectionTools,
): DiagnosticsSection => ({
  title: 'WebRTC',
  rows: [
    ...tools.whenKnown(
      ['State', webRtc.connected ? 'connected' : 'not connected'],
      [
        'Signaling',
        `${webRtc.signalingServer ?? 'not configured'} (${
          webRtc.signalingConnected ? 'connected' : 'not connected'
        })`,
      ],
      [
        'Peer connection',
        `${webRtc.peerConnectionState ?? 'none'}, ICE ${
          webRtc.iceConnectionState ?? 'none'
        }`,
      ],
      [
        'Connected for',
        webRtc.connected && webRtc.connectedForMs !== undefined
          ? formatDuration(webRtc.connectedForMs)
          : undefined,
      ],
      ['Last error', formatError(webRtc.lastError)],
    ),
    ...tools.rows(
      ['Connections', tools.connectsOf('webrtc')],
      ['Messages', tools.messagesVia('webrtc')],
    ),
  ],
  events: tools.eventsOf('webrtc'),
})

/**
 * The sections of one link's diagnostics: the link as a whole, then each transport
 * its mode uses. A value the running version does not report is left out, or said
 * so when it is `outdated` (it runs an older build than the page).
 */
export const connectionSections = (
  connection: WalletConnectionDiagnostics,
  { outdated = false }: { outdated?: boolean } = {},
): ConnectionSections => {
  const tools = SectionTools(connection, outdated)
  const { iroh, webRtc } = connection
  const transports: DiagnosticsSection[] = []
  const unused: string[] = []
  if (iroh) transports.push(irohSection(connection, iroh, tools))
  else if (connection.transport) unused.push('iroh: not used in this mode')
  if (webRtc) transports.push(webRtcSection(webRtc, tools))
  else if (connection.transport) unused.push('WebRTC: not used in this mode')
  return { general: generalSection(connection, tools), transports, unused }
}

const sectionLines = (section: DiagnosticsSection, indent: string) => [
  ...section.rows.map(({ label, value }) => `${indent}${label}: ${value}`),
  ...(section.events.length
    ? [
        `${indent}Recent events:`,
        ...section.events.map((line) => `${indent}  ${line}`),
      ]
    : []),
  ...(section.libraryEvents?.length
    ? [
        `${indent}iroh library warnings about this link:`,
        ...section.libraryEvents.map((line) => `${indent}  ${line}`),
      ]
    : []),
]

export const formatDiagnosticsReport = (input: {
  generatedAt: Date
  extensionVersion: string
  browser: string
  connections: WalletConnectionDiagnostics[]
  offscreen?: OffscreenDiagnostics
  irohLibraryEvents?: IrohLibraryEvent[]
  /** The build of the page making the report: says when the offscreen one differs. */
  pageBuild?: string
}) => {
  const outdated =
    input.pageBuild !== undefined &&
    isOutdatedBuild(input.offscreen, input.pageBuild)
  const lines = ['Radix Wallet Connector: connection diagnostics']
  if (outdated) lines.push(`NOTE: ${outdatedBuildNotice}`)
  lines.push(
    // Every time below is local, in this zone.
    `Generated: ${formatTime(input.generatedAt.getTime())} (${formatUtcOffset(
      input.generatedAt.getTime(),
    )}; ${input.generatedAt.toISOString()})`,
    `Extension: ${input.extensionVersion}`,
    `Browser: ${input.browser}`,
  )
  if (input.offscreen)
    lines.push(
      `Offscreen document: ${input.offscreen.instance}, build ${
        input.offscreen.build ?? notReported
      }, running for ${formatDuration(input.offscreen.uptimeMs)} (${
        input.offscreen.uptimeMs
      } ms)`,
    )
  lines.push(`Linked wallets: ${input.connections.length}`)
  for (const connection of input.connections) {
    const { general, transports, unused } = connectionSections(connection, {
      outdated,
    })
    lines.push(
      '',
      `Wallet ${connection.walletKey}`,
      ...sectionLines(general, '  '),
    )
    for (const section of transports)
      lines.push(`  ${section.title}:`, ...sectionLines(section, '    '))
    lines.push(...unused.map((line) => `  ${line}`))
  }
  if (input.irohLibraryEvents)
    lines.push(
      '',
      `iroh library warnings and errors: ${
        input.irohLibraryEvents.length ? '' : 'none'
      }`.trimEnd(),
      ...input.irohLibraryEvents.map(
        (event) => `  ${describeLibraryEvent(event)}`,
      ),
    )
  return `${lines.join('\n')}\n`
}
