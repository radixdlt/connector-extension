import { Box, Link, QrCode, Text, Header } from '../components'

type ScanQrProps = {
  connectionPassword: string | undefined
}

export const ScanQrCode = ({ connectionPassword }: ScanQrProps) => {
  if (!connectionPassword || connectionPassword === 'unset') return null

  return (
    <Box>
      <Header mb="lg">Radix Wallet Connector</Header>
      <Text
        mb="3xl"
        size="xSmall"
        color="radixGrey2"
        style={{ lineHeight: '15.6px' }}
      >
        Scan the QR code with Radix Wallet on your mobile phone to start using
        it with dApps in this web browser.
      </Text>
      <QrCode value={connectionPassword} data-testid="custom-element" />
      <Box textAlign="center">
        <Link href="https://radixdlt.com" target="_blank">
          {`Don't have Radix Wallet?`}
        </Link>
      </Box>
    </Box>
  )
}
