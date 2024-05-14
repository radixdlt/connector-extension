import { useConnectionsClient } from 'pairing/state/connections'
import { Box, Link as LinkComponent, QrCode } from '../../components'
import { PairingHeader } from './pairing-header'
import { Link } from 'react-router-dom'
import { RelinkWarning } from './relink-warning'

export const ConnectionPassword = ({
  connectionPassword,
  publicKey,
  signature,
  purpose,
}: {
  connectionPassword?: string
  publicKey?: string
  signature?: string
  purpose?: 'general'
}) => {
  if (!connectionPassword || !publicKey || !signature) return null

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

      <Box mt="xl" mb="xl" p="none">
        <QrCode
          value={JSON.stringify({
            password: connectionPassword,
            publicKey,
            signature,
            purpose,
          })}
          data-testid="custom-element"
        />
      </Box>

      <Box textAlign="center" mb="md">
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
      <RelinkWarning />
    </>
  )
}
