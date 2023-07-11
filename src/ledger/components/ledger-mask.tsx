import { Box, Button, Text } from 'components'
import { LedgerDevice } from 'ledger/schemas'
import { LedgerDeviceBox } from './ledger-device-box'
import Retry from '../assets/retry.svg'
export const LedgerMask = (props: {
  header: string
  error?: string
  ledgerDevice?: LedgerDevice
  onRetry?: () => void
  children?: React.ReactNode
}) => {
  const { header, onRetry, ledgerDevice, error } = props
  const renderLedgerDevice = () => {
    if (!ledgerDevice) return null

    return (
      <Box style={{ margin: '0 auto 28px', display: 'inline-block' }}>
        <LedgerDeviceBox {...ledgerDevice}></LedgerDeviceBox>
      </Box>
    )
  }

  const renderErrorBox = () => {
    if (!error) return null
    return (
      <Box
        px="large"
        py="large"
        radius="small"
        textAlign="left"
        flex="row"
        items="center"
        style={{ border: '1px dashed var(--colors-radixGrey2)', gap: '40px' }}
      >
        <Box>
          <Text size="2xl" bold mb="md">
            {error}
          </Text>

          <ol style={{ marginLeft: '0', paddingInlineStart: '20px' }}>
            <li>Connect one Ledger device to this computer via USB.</li>
            <li>
              Unlock it with your PIN and open the “Radix Babylon” app on it.
            </li>
            <li> Click retry here.</li>
          </ol>
        </Box>
        <Button onClick={onRetry}>
          <img src={Retry} />
          Retry
        </Button>
      </Box>
    )
  }
  return (
    <Box
      mt="4xl"
      bg="white"
      radius="medium"
      p="large"
      position="relative"
      textAlign="center"
      maxWidth="medium"
    >
      <Box
        position="absolute"
        style={{
          left: 0,
          right: 0,
        }}
      >
        <img
          src="/radix-icon_128x128.png"
          style={{
            width: '78px',
            height: '78px',
            transform: 'translateY(-66px)',
            boxShadow: '0 4px 10px 0 rgba(0, 0, 0, 0.25)',
            borderRadius: '16px',
          }}
        />
      </Box>

      <Text size="large" color="radixGrey2" mt="xl">
        Radix Wallet Connector
      </Text>
      <Text color="radixGrey1" size="4xl" mt="lg" mb="md">
        {header}
      </Text>
      <Box mb="lg">{props.children}</Box>

      {renderLedgerDevice()}
      {renderErrorBox()}
    </Box>
  )
}
