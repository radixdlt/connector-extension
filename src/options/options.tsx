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
  FormControlLabel,
  FormGroup,
  Switch,
  ThemeProvider,
  createTheme,
} from '@mui/material'

const theme = createTheme({
  typography: {
    fontFamily: 'IBM Plex Sans',
  },
})

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
              </FormGroup>
            )}
          </Box>
        </Mask>
      </Box>
    </ThemeProvider>
  )
}
