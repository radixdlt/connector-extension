import { Box, Button, Header } from 'components'
import { ErrorText } from '../components/error-text'
import { getPublicKey as ledgerGetPublicKey } from 'ledger/ledger-wrapper'
import {
  createLedgerPublicKeyResponse,
  LedgerPublicKeyRequest,
  LedgerResponse,
} from 'ledger/schemas'
import { PairingHeader } from 'pairing/components/pairing-header'
import { useState } from 'react'

export const ApplyLedgerFactor = ({
  message,
  respond,
}: {
  message: LedgerPublicKeyRequest
  respond: (response: LedgerResponse) => void
}) => {
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const getPublicKey = async () => {
    setIsLoading(true)
    const publicKey = await ledgerGetPublicKey(message)

    if (publicKey.isOk()) {
      respond(createLedgerPublicKeyResponse(message, publicKey.value))
    } else {
      setError(publicKey.error)
    }
    setIsLoading(false)
  }
  return (
    <>
      <PairingHeader header="Apply Ledger Factor to Account Security">
        Please connect the following Ledger hardware wallet device to this
        computer and click Continue:
      </PairingHeader>

      <ErrorText error={error} />
      <Box textAlign="center" py="large">
        <Header>{message.ledgerDevice.name}</Header>
      </Box>
      <Button full mt="large" onClick={getPublicKey} disabled={isLoading}>
        Continue
      </Button>
    </>
  )
}
