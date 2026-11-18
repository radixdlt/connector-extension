import { radixConnectConfig } from 'config'
import {
  radixConnectTransports,
  usesIroh,
  type RadixConnectTransport,
} from 'options/radix-connect-transport'
import { transportLabels } from 'options/diagnostics-report'
import { RadioRow, SettingsSection, TextFieldRow } from '../settings-ui'
import { useExtensionOptions } from '../use-extension-options'
import type { ScreenProps } from './screen'
import { SettingsSubPage } from './sub-page'

const transportSubtitles: Record<RadixConnectTransport, string> = {
  webrtc: 'Through the signaling server: the default',
  iroh: 'Through iroh relays (QUIC)',
  webrtcAndIroh: 'Both: messages go through iroh while it is connected',
}

export const RadixConnectSettings = ({ page }: ScreenProps) => {
  const {
    options,
    loaded,
    radixConnectTransport,
    update,
    irohRelayUrlDraft,
    irohRelayUrlError,
    setIrohRelayUrlDraft,
    saveIrohRelayUrl,
  } = useExtensionOptions()

  return (
    <SettingsSubPage title="Radix Connect" page={page}>
      <SettingsSection
        title="Transport"
        radioGroup
        description="How the extension reaches your linked wallets. Each wallet must use the same transport."
      >
        {radixConnectTransports.map((transport) => (
          <RadioRow
            key={transport}
            name="radixConnectTransport"
            value={transport}
            title={transportLabels[transport]}
            subtitle={transportSubtitles[transport]}
            checked={loaded ? radixConnectTransport === transport : undefined}
            onSelect={() => update({ radixConnectTransport: transport })}
          />
        ))}
      </SettingsSection>
      <SettingsSection
        title="Signaling server"
        radioGroup
        description={
          !loaded || options.radixConnectConfiguration === 'production'
            ? 'For WebRTC. The wallet must use the same one: Production is its default.'
            : 'For WebRTC. The wallet must use the same one, and its default is Production: with another one here, WebRTC does not connect to a wallet left at its default.'
        }
      >
        {Object.entries(radixConnectConfig)
          .filter(([name]) => name !== 'test')
          .map(([name, connectionConfig]) => (
            <RadioRow
              key={name}
              name="radixConnectConfiguration"
              value={name}
              title={name[0].toUpperCase() + name.slice(1)}
              subtitle={connectionConfig.signalingServerBaseUrl}
              checked={
                loaded ? options.radixConnectConfiguration === name : undefined
              }
              onSelect={(value) => update({ radixConnectConfiguration: value })}
            />
          ))}
        <RadioRow
          name="radixConnectConfiguration"
          value="custom"
          title="Custom"
          checked={
            loaded ? options.radixConnectConfiguration === 'custom' : undefined
          }
          onSelect={(value) => update({ radixConnectConfiguration: value })}
        />
        {options.radixConnectConfiguration === 'custom' && (
          <TextFieldRow
            label="Custom signaling server URL"
            placeholder="wss://your-signaling-server.example.com"
            value={options.customSignalingServerUrl || ''}
            onChange={(event) =>
              update({ customSignalingServerUrl: event.target.value })
            }
          />
        )}
      </SettingsSection>
      {usesIroh(radixConnectTransport) && (
        <SettingsSection title="iroh relay">
          <TextFieldRow
            label="Custom iroh relay (optional)"
            placeholder="Public relays (n0, closest)"
            value={irohRelayUrlDraft}
            error={irohRelayUrlError}
            help={
              irohRelayUrlDraft.trim()
                ? 'Custom relay: the wallet must use the same one'
                : 'Empty: n0’s public relays, nothing to configure'
            }
            onChange={(event) => setIrohRelayUrlDraft(event.target.value)}
            onBlur={saveIrohRelayUrl}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveIrohRelayUrl()
            }}
          />
        </SettingsSection>
      )}
    </SettingsSubPage>
  )
}
