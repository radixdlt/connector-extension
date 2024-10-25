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
          !connectionsClient.hasConnections()
            ? 'Radix Wallet Connector'
            : 'Link New Radix Wallet'
        }
      >
        <strong>To link your wallet to this web browser</strong>: In your Radix
        Wallet app, tap the gear icon for wallet settings, then tap{' '}
        <strong>Linked Connectors</strong> and then{' '}
        <strong>Link New Connector</strong> to scan the QR code.
      </PairingHeader>

      <Box mt="sm" mb="sm" p="none">
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

      <Box textAlign="center" mb="lg">
        {connectionsClient.hasConnections() ? (
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
        ) : (
          <LinkComponent
            style={{ fontSize: '16px', color: 'white', fontWeight: 'bold' }}
            href="https://wallet.radixdlt.com"
            target="_blank"
          >
            {`Don't have Radix Wallet?`}
          </LinkComponent>
        )}
      </Box>
      <RelinkWarning />
    </>
  )
}
