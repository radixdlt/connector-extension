import { Box, Text } from 'components'
import { LedgerDevice } from '../schemas'
import IconHardwareLedger from '../assets/icon-hardware-ledger.svg'
const deviceName = {
  nanoS: 'Nano S',
  'nanoS+': 'Nano S+',
  nanoX: 'Nano X',
} as const

export const LedgerDeviceBox = (params: LedgerDevice) => (
  <Box
    style={{
      display: 'flex',
      width: '387px',
      padding: '23px 34px',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      borderRadius: '12px',
      background: '#F4F5F9',
      boxShadow: '0px 6.720985412597656px 16px 0px rgba(0, 0, 0, 0.25)',
    }}
  >
    <Box items="center" justify="start" full style={{ gap: '30px' }}>
      <img src={IconHardwareLedger} />

      <Box textAlign="left">
        <Text size="large" bold color="radixGrey1">
          {params.name}
        </Text>
        <Text size="large" color="radixGrey2">
          {deviceName[params.model]}
        </Text>
      </Box>
    </Box>
  </Box>
)
