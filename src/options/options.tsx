import { chromeStorageSync } from 'chrome/helpers/chrome-storage-sync'
import { Box, Mask } from 'components'
import { useEffect, useState } from 'react'
import {
  ConnectorExtensionOptions,
  defaultConnectorExtensionOptions,
  getExtensionOptions,
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
import { RadixNetworkConfig } from '@radixdlt/babylon-gateway-api-sdk'

const theme = createTheme({
  typography: {
    fontFamily: 'IBM Plex Sans',
  },
})

const radixNetworkConfigMap = Object.entries(RadixNetworkConfig).reduce(
  (prev, [network, config]) => {
    prev[config.networkId] = config
    return prev
  },
  {} as Record<
    number,
    (typeof RadixNetworkConfig)[keyof typeof RadixNetworkConfig]
  >,
)

export const Options = () => {
  const [options, setOptions] = useState<ConnectorExtensionOptions | undefined>(
    defaultConnectorExtensionOptions,
  )

  useEffect(() => {
    getExtensionOptions().map(setOptions)
  }, [])

  const handleChange = (key: string, event: any) => {
    const updatedOptions = {
      ...options,
      [key]: event.target.checked,
    }

    setOptions(updatedOptions)
    chromeStorageSync.setSingleItem('options', updatedOptions)
  }
  const handleTextChange = (key: string, event: any) => {
    const updatedOptions = {
      ...options,
      [key]: event.target.value,
    }

    setOptions(updatedOptions)
    chromeStorageSync.setSingleItem('options', updatedOptions)
  }

  const handleNetworkIdChange = (networkId: number | string) => {
    const networkIdNumber = Number(networkId)
    const updatedOptions = {
      ...options,
      networkId: networkIdNumber,
      dashboardBaseUrl:
        radixNetworkConfigMap[networkIdNumber]?.dashboardUrl || '',
      gatewayApiBaseUrl:
        radixNetworkConfigMap[networkIdNumber]?.gatewayUrl || '',
    }
    setOptions(updatedOptions)
    chromeStorageSync.setSingleItem('options', updatedOptions)
  }
  return (
    <ThemeProvider theme={theme}>
      <Box full flex="row" items="center" justify="center">
        <Mask>
          <Box mt="lg">
            {options && (
              <FormGroup>
                <Divider style={{ margin: '0 0 20px' }}>Notifications</Divider>
                <FormControlLabel
                  control={
                    <Switch
                      checked={options.showDAppRequestNotifications}
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
                      checked={options.showTransactionResultNotifications}
                      onChange={(ev) =>
                        handleChange('showTransactionResultNotifications', ev)
                      }
                    />
                  }
                  label="Show transaction result desktop notifications"
                />
                <Divider style={{ margin: '20px 0 0' }}>Network</Divider>
                <FormControl
                  fullWidth
                  size="small"
                  margin="normal"
                  style={{ textAlign: 'left' }}
                >
                  <InputLabel id="gateway">Name</InputLabel>
                  <Select
                    labelId="gateway"
                    value={options.networkId}
                    label="Name"
                    onChange={(ev) => handleNetworkIdChange(ev.target.value)}
                  >
                    {Object.entries(RadixNetworkConfig).map(
                      ([network, config]) => (
                        <MenuItem key={network} value={config.networkId}>
                          {network}
                        </MenuItem>
                      ),
                    )}
                    <MenuItem key="custom" value={0}>
                      Custom
                    </MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  margin="normal"
                  label="Gateway API"
                  value={options.gatewayApiBaseUrl}
                  onChange={(ev) => handleTextChange('gatewayApiBaseUrl', ev)}
                  InputProps={{
                    readOnly: options.networkId !== 0,
                  }}
                />

                <TextField
                  margin="normal"
                  label="Dashboard URL"
                  value={options.dashboardBaseUrl}
                  onChange={(ev) => handleTextChange('dashboardBaseUrl', ev)}
                  InputProps={{
                    readOnly: options.networkId !== 0,
                  }}
                />
              </FormGroup>
            )}
          </Box>
        </Mask>
      </Box>
    </ThemeProvider>
  )
}
