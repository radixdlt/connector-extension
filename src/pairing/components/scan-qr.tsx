import { Box, Link, QrCode } from '../../components'
import { PairingHeader } from './pairing-header'

type ScanQrProps = {
  connectionPassword: string | undefined
}

export const ScanQrCode = ({ connectionPassword }: ScanQrProps) => {
  if (!connectionPassword || connectionPassword === 'unset') return null

  return (
    <>
      <PairingHeader header="Radix Wallet Connector">
        Scan the QR code with Radix Wallet on your mobile phone to start using
        it with dApps in this web browser.
      </PairingHeader>
      <Box mt="3xl" p="none">
        <QrCode value={connectionPassword} data-testid="custom-element" />
      </Box>
      <Box textAlign="center">
        <Link href="https://radixdlt.com" target="_blank">
          {`Don't have Radix Wallet?`}
        </Link>
      </Box>
    </>
  )
}
