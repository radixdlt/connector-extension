import { Box, Mask } from 'components'
import { useEffect, useState } from 'react'
import {
  ConnectorExtensionOptions,
  defaultConnectorExtensionOptions,
  getExtensionOptions,
  setConnectorExtensionOptions,
} from '.'
import {
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  ThemeProvider,
  createTheme,
} from '@mui/material'
import { isDevMode, isPublicRelease, radixConnectConfig } from 'config'
import {
  parseIrohRelayUrl,
  parseRadixConnectTransport,
  usesIroh,
  type RadixConnectTransport,
} from './radix-connect-transport'
import { loadIroh } from 'chrome/offscreen/wallet-connection/transport/iroh/load-iroh'

const transportLabels: Record<RadixConnectTransport, string> = {
  webrtc: 'WebRTC',
  iroh: 'iroh',
  webrtcAndIroh: 'WebRTC and iroh',
}

const theme = createTheme({
  typography: {
    fontFamily: 'IBM Plex Sans',
  },
})

export const Options = () => {
  const [connectorExtensionOptions, setOptions] =
    useState<ConnectorExtensionOptions>(defaultConnectorExtensionOptions)
  // Saved when the field loses focus, and only if valid: every change of the relay
  // restarts the iroh sessions.
  const [irohRelayUrlDraft, setIrohRelayUrlDraft] = useState('')
  // Reason the iroh library gives for not accepting the relay URL.
  const [irohRelayUrlRejection, setIrohRelayUrlRejection] = useState<string>()

  useEffect(() => {
    getExtensionOptions().map((options) => {
      setOptions(options)
      setIrohRelayUrlDraft(options.irohRelayUrl ?? '')
    })
  }, [])

  const radixConnectTransport = parseRadixConnectTransport(
    connectorExtensionOptions.radixConnectTransport,
  )
  const irohRelayUrl = parseIrohRelayUrl(irohRelayUrlDraft)
  const irohRelayUrlError = irohRelayUrl.isErr()
    ? irohRelayUrl.error
    : irohRelayUrlRejection

  const handleChange = (
    key: 'showTransactionResultNotifications' | 'showDAppRequestNotifications',
    event: any,
  ) => {
    const updatedOptions = {
      ...connectorExtensionOptions,
      [key]: event.target.checked,
    }
    setOptions(updatedOptions)
    setConnectorExtensionOptions(updatedOptions)
  }

  const handleRadixConnectConfigurationChange = (name: string) => {
    const updatedOptions = {
      ...connectorExtensionOptions,
      radixConnectConfiguration: name,
    }
    setOptions(updatedOptions)
    setConnectorExtensionOptions(updatedOptions)
  }

  const handleCustomSignalingServerUrlChange = (url: string) => {
    const updatedOptions = {
      ...connectorExtensionOptions,
      customSignalingServerUrl: url,
    }
    setOptions(updatedOptions)
    setConnectorExtensionOptions(updatedOptions)
  }

  const handleRadixConnectTransportChange = (value: string) => {
    const updatedOptions = {
      ...connectorExtensionOptions,
      radixConnectTransport: parseRadixConnectTransport(value),
    }
    setOptions(updatedOptions)
    setConnectorExtensionOptions(updatedOptions)
  }

  const saveIrohRelayUrl = () => {
    if (irohRelayUrl.isErr()) return
    const normalized = irohRelayUrl.value ?? ''
    setIrohRelayUrlDraft(normalized)
    if (normalized === (connectorExtensionOptions.irohRelayUrl ?? '')) return

    const save = () => {
      const updatedOptions = {
        ...connectorExtensionOptions,
        irohRelayUrl: normalized,
      }
      setOptions(updatedOptions)
      setConnectorExtensionOptions(updatedOptions)
    }

    if (!normalized) return save()

    // On top of the extension's rules above, the URL must be one the library can
    // use. Should the module not load here, sessions still refuse an unusable URL.
    loadIroh()
      .map((iroh) => iroh.validateRelayUrl(normalized))
      .match(
        (rejection) => {
          setIrohRelayUrlRejection(rejection)
          if (!rejection) save()
        },
        () => save(),
      )
  }

  return (
    <ThemeProvider theme={theme}>
      <Box full flex="row" items="center" justify="center">
        <Mask>
          <Box mt="lg">
            {connectorExtensionOptions && (
              <FormGroup>
                <Divider style={{ margin: '0 0 20px' }}>Notifications</Divider>
                <FormControlLabel
                  control={
                    <Switch
                      checked={
                        connectorExtensionOptions.showDAppRequestNotifications
                      }
                      onChange={(ev) =>
                        handleChange('showDAppRequestNotifications', ev)
                      }
                    />
                  }
                  label="Show dApp request desktop notifications"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={
                        connectorExtensionOptions.showTransactionResultNotifications
                      }
                      onChange={(ev) =>
                        handleChange('showTransactionResultNotifications', ev)
                      }
                    />
                  }
                  label="Show transaction result desktop notifications"
                />
                {isPublicRelease && !isDevMode ? null : (
                  <>
                    <Divider style={{ margin: '20px 0 20px' }}>
                      Radix Connect
                    </Divider>
                    <FormControl
                      fullWidth
                      size="small"
                      margin="normal"
                      style={{ textAlign: 'left' }}
                    >
                      <InputLabel id="radixConnectTransport">
                        Transport
                      </InputLabel>
                      <Select
                        labelId="radixConnectTransport"
                        value={radixConnectTransport}
                        label="Transport"
                        onChange={(ev) =>
                          handleRadixConnectTransportChange(ev.target.value)
                        }
                      >
                        {Object.entries(transportLabels).map(
                          ([transport, label]) => (
                            <MenuItem key={transport} value={transport}>
                              {label}
                            </MenuItem>
                          ),
                        )}
                      </Select>
                    </FormControl>
                    <FormControl
                      fullWidth
                      size="small"
                      margin="normal"
                      style={{ textAlign: 'left' }}
                    >
                      <InputLabel id="radixConnectName">
                        Signaling Server
                      </InputLabel>
                      <Select
                        labelId="radixConnectName"
                        value={
                          connectorExtensionOptions.radixConnectConfiguration
                        }
                        label="Signaling Server"
                        onChange={(ev) =>
                          handleRadixConnectConfigurationChange(ev.target.value)
                        }
                      >
                        {Object.entries(radixConnectConfig)
                          .filter(([key]) => key !== 'test')
                          .map(([name, config]) => (
                            <MenuItem key={name} value={name}>
                              {name} ({config.signalingServerBaseUrl})
                            </MenuItem>
                          ))}
                        <MenuItem value="custom">Custom</MenuItem>
                      </Select>
                    </FormControl>
                    {connectorExtensionOptions.radixConnectConfiguration ===
                      'custom' && (
                      <TextField
                        fullWidth
                        size="small"
                        label="Custom Signaling Server URL"
                        placeholder="wss://your-signaling-server.example.com"
                        value={
                          connectorExtensionOptions.customSignalingServerUrl ||
                          ''
                        }
                        onChange={(ev) =>
                          handleCustomSignalingServerUrlChange(ev.target.value)
                        }
                        style={{ marginTop: 12 }}
                      />
                    )}
                    {usesIroh(radixConnectTransport) && (
                      <TextField
                        fullWidth
                        size="small"
                        label="iroh Relay URL"
                        placeholder="Empty: n0's public relays"
                        value={irohRelayUrlDraft}
                        error={!!irohRelayUrlError}
                        helperText={
                          irohRelayUrlError ??
                          'With a custom relay, the wallet must use the same one'
                        }
                        onChange={(ev) => {
                          setIrohRelayUrlDraft(ev.target.value)
                          setIrohRelayUrlRejection(undefined)
                        }}
                        onBlur={saveIrohRelayUrl}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') saveIrohRelayUrl()
                        }}
                        style={{ marginTop: 12 }}
                      />
                    )}
                  </>
                )}
              </FormGroup>
            )}
          </Box>
        </Mask>
      </Box>
    </ThemeProvider>
  )
}
