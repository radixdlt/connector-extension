import { Box, Button, Mask, Text } from 'components'
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
              Unlock it with your PIN and open the “Radix Babylon” app on it. If
              you see <strong>Pending Review</strong>, push any button.
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
    <Mask>
      <Text color="radixGrey1" size="4xl" mt="lg" mb="md">
        {header}
      </Text>
      <Box mb="lg">{props.children}</Box>

      {renderLedgerDevice()}
      {renderErrorBox()}
    </Mask>
  )
}
