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
  ThemeProvider,
  createTheme,
} from '@mui/material'
import { radixConnectConfig } from 'config'

const theme = createTheme({
  typography: {
    fontFamily: 'IBM Plex Sans',
  },
})

export const Options = () => {
  const [connectorExtensionOptions, setOptions] =
    useState<ConnectorExtensionOptions>(defaultConnectorExtensionOptions)

  useEffect(() => {
    getExtensionOptions().map(setOptions)
  }, [])

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
                <Divider style={{ margin: '20px 0 20px' }}>
                  Radix Connect
                </Divider>
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
                    value={connectorExtensionOptions.radixConnectConfiguration}
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
                  </Select>
                </FormControl>
              </FormGroup>
            )}
          </Box>
        </Mask>
      </Box>
    </ThemeProvider>
  )
}
