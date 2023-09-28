import { Box, Link, QrCode } from '../../components'
import { PairingHeader } from './pairing-header'

export const ConnectionPassword = ({
  connectionPassword,
}: {
  connectionPassword?: string
}) => {
  if (!connectionPassword) return null

  return (
    <>
      <PairingHeader header="Radix Wallet Connector">
        Scan the QR code with the Radix Wallet app on your mobile phone to start
        using it with dApps in this web browser.
      </PairingHeader>
      <Box mt="3xl" p="none">
        <QrCode value={connectionPassword} data-testid="custom-element" />
      </Box>
      <Box textAlign="center">
        <Link
          style={{ fontSize: '16px', color: 'white', fontWeight: 'bold' }}
          href="https://wallet.radixdlt.com"
          target="_blank"
        >
          {`Don't have Radix Wallet?`}
        </Link>
      </Box>
    </>
  )
}
