import { useConnectionsClient } from 'pairing/state/connections'
import { Box, Link as LinkComponent, QrCode } from '../../components'
import { PairingHeader } from './pairing-header'
import { Link } from 'react-router-dom'

export const ConnectionPassword = ({
  connectionPassword,
}: {
  connectionPassword?: string
}) => {
  if (!connectionPassword) return null
  const connectionsClient = useConnectionsClient()
  return (
    <>
      <PairingHeader
        header={
          connectionsClient.hasNoConnections()
            ? 'Radix Wallet Connector'
            : 'Link New Radix Wallet'
        }
      >
        Scan the QR code with the Radix Wallet app on your mobile phone to start
        using it with dApps in this web browser.
      </PairingHeader>
      <Box mt="3xl" p="none">
        <QrCode value={connectionPassword} data-testid="custom-element" />
      </Box>

      <Box textAlign="center">
        {connectionsClient.hasNoConnections() ? (
          <LinkComponent
            style={{ fontSize: '16px', color: 'white', fontWeight: 'bold' }}
            href="https://wallet.radixdlt.com"
            target="_blank"
          >
            {`Don't have Radix Wallet?`}
          </LinkComponent>
        ) : (
          <Link
            style={{
              fontSize: '16px',
              color: 'white',
              fontWeight: 'bold',
              textDecoration: 'none',
            }}
            to="/"
          >
            Cancel
          </Link>
        )}
      </Box>
    </>
  )
}
