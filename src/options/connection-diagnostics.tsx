import { extensionVersion } from 'utils/extension-version'
import { useEffect, useState } from 'react'
import { config } from 'config'
import type {
  ConnectionDiagnosticsResponse,
  WalletConnectionDiagnostics,
} from 'chrome/offscreen/wallet-connection/transport/diagnostics'
import { transportStatusOf } from 'pairing/state/wallet-transport-status'
import { SettingsRow, SettingsSection } from 'settings/settings-ui'
import { CopyIcon, WarningIcon } from 'ui/icons'
import { requestConnectionDiagnostics } from './connection-diagnostics-client'
import {
  connectionSections,
  describeLibraryEvent,
  formatDiagnosticsReport,
  formatDuration,
  isOutdatedBuild,
  outdatedBuildNotice,
  type DiagnosticsSection,
} from './diagnostics-report'
import './connection-diagnostics.css'

type DiagnosticsState =
  | { status: 'loading' }
  | ({ status: 'ready' } & ConnectionDiagnosticsResponse)
  | { status: 'unavailable'; reason: string }

/** The transport carrying a link, as a pill: "iroh", "WebRTC", "Not connected". */
export const TransportPill = ({
  connection,
}: {
  connection: WalletConnectionDiagnostics
}) => {
  const { connected, label } = transportStatusOf(connection)
  return (
    <span className={`rdx-pill${connected ? ' rdx-pill--ok' : ''}`}>
      {connected && <span className="rdx-visually-hidden">Connected via </span>}
      {label}
    </span>
  )
}

/** A titled list of event lines, or nothing when empty. */
const EventList = ({ title, lines }: { title: string; lines: string[] }) =>
  lines.length ? (
    <li className="rdx-events">
      <p className="rdx-events__title">{title}</p>
      <ul>
        {lines.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    </li>
  ) : null

const Section = ({
  section,
  title,
}: {
  section: DiagnosticsSection
  title: string
}) => (
  <div data-testid={`diagnostics-section-${section.title ?? 'link'}`}>
    <SettingsSection title={title}>
      {section.rows.map(({ label, value }) => (
        <li key={label} className="rdx-kv">
          <span className="rdx-kv__label">{label}</span>
          <span className="rdx-kv__value">{value}</span>
        </li>
      ))}
      <EventList title="Recent events (oldest first)" lines={section.events} />
      <EventList
        title="iroh library warnings about this link"
        lines={section.libraryEvents ?? []}
      />
    </SettingsSection>
  </div>
)

/**
 * Connection diagnostics of every linked wallet, refreshed every few seconds, and a
 * button copying them as a text report for bug reports.
 * `advanced`: every detail of each wallet (the link, then each transport its mode
 * uses); otherwise one row each, connected or not and through which transport. The
 * copied report is always complete.
 */
export const ConnectionDiagnostics = ({
  advanced = false,
}: {
  advanced?: boolean
}) => {
  const [state, setState] = useState<DiagnosticsState>({ status: 'loading' })
  const [copyStatus, setCopyStatus] = useState<string>()

  useEffect(() => {
    let active = true
    const refresh = () =>
      requestConnectionDiagnostics(config.diagnostics.requestTimeout).match(
        (response) => {
          if (active) setState({ status: 'ready', ...response })
        },
        (error) => {
          if (active) setState({ status: 'unavailable', reason: error.message })
        },
      )
    refresh()
    const timer = setInterval(refresh, config.diagnostics.refreshInterval)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  // The offscreen document still runs the build that was loaded before this page's.
  const outdated =
    state.status === 'ready' && isOutdatedBuild(state.offscreen, config.buildId)

  const copyReport = () => {
    if (state.status !== 'ready') return
    const report = formatDiagnosticsReport({
      generatedAt: new Date(),
      extensionVersion: extensionVersion(),
      browser: navigator.userAgent,
      connections: state.connections,
      offscreen: state.offscreen,
      irohLibraryEvents: state.irohLibraryEvents,
      pageBuild: config.buildId,
    })
    navigator.clipboard
      .writeText(report)
      .then(() => setCopyStatus('Copied'))
      .catch(() => setCopyStatus('Could not copy'))
  }

  return (
    <div data-testid="connection-diagnostics">
      {outdated && (
        <div className="rdx-notice" data-testid="outdated-build-notice">
          <WarningIcon />
          <span>{outdatedBuildNotice}</span>
        </div>
      )}
      {state.status !== 'ready' && (
        <SettingsSection title="Linked wallets">
          <SettingsRow
            title={
              state.status === 'loading'
                ? 'Loading…'
                : `Diagnostics unavailable: ${state.reason}`
            }
          />
        </SettingsSection>
      )}
      {state.status === 'ready' && state.connections.length === 0 && (
        <SettingsSection title="Linked wallets">
          <SettingsRow title="No linked wallets." />
        </SettingsSection>
      )}
      {state.status === 'ready' &&
        !advanced &&
        state.connections.length > 0 && (
          <SettingsSection title="Linked wallets">
            {state.connections.map((connection) => (
              <SettingsRow
                key={connection.walletKey}
                testId="wallet-status"
                title={connection.walletName}
                subtitle={`Wallet ${connection.walletKey}`}
                trailing={<TransportPill connection={connection} />}
              />
            ))}
          </SettingsSection>
        )}
      {state.status === 'ready' &&
        advanced &&
        state.connections.map((connection) => {
          const { general, transports, unused } = connectionSections(
            connection,
            { outdated },
          )
          return (
            <div key={connection.walletKey} data-testid="wallet-diagnostics">
              <Section
                section={general}
                title={`${connection.walletName} (${connection.walletKey})`}
              />
              {transports.map((section) => (
                <Section
                  key={section.title}
                  section={section}
                  title={section.title ?? ''}
                />
              ))}
              {unused.map((line) => (
                <p key={line} className="rdx-diagnostics__meta">
                  {line}
                </p>
              ))}
            </div>
          )
        })}
      {state.status === 'ready' && advanced && (
        <>
          {state.offscreen && (
            <p className="rdx-diagnostics__meta">
              Offscreen document {state.offscreen.instance}, running for{' '}
              {formatDuration(state.offscreen.uptimeMs)}
            </p>
          )}
          {!!state.irohLibraryEvents?.length && (
            <SettingsSection title="iroh library warnings and errors">
              <EventList
                title="Most recent last"
                lines={state.irohLibraryEvents.map(describeLibraryEvent)}
              />
            </SettingsSection>
          )}
        </>
      )}
      <div className="rdx-copy-row" style={{ justifyContent: 'flex-end' }}>
        {copyStatus && <span role="status">{copyStatus}</span>}
        <button
          type="button"
          className="rdx-text-button"
          disabled={state.status !== 'ready'}
          onClick={copyReport}
          aria-label="Copy diagnostics to the clipboard"
          title="Copy diagnostics to the clipboard"
        >
          <CopyIcon />
          Copy diagnostics
        </button>
      </div>
    </div>
  )
}
