import { Box, Header } from 'components'
import { LedgerDevice } from '../schemas'

const deviceName = {
  nanoS: 'Nano S',
  'nanoS+': 'Nano S+',
  nanoX: 'Nano X',
} as const

export const LedgerDeviceBox = (params: LedgerDevice) => (
  <Box textAlign="center" py="large">
    <Header>
      {params.name} ({deviceName[params.model]})
    </Header>
  </Box>
)
