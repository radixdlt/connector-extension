import { Button, Header, Box } from 'components'
import { ErrorText } from 'ledger/components/error-text'
import { signTransaction } from 'ledger/ledger-wrapper'
import {
  LedgerResponse,
  LedgerSignTransactionRequest,
  createSignTxResponse,
} from 'ledger/schemas'
import { PairingHeader } from 'pairing/components/pairing-header'
import { useState } from 'react'

export const SignTransaction = ({
  message,
  respond,
}: {
  message: LedgerSignTransactionRequest
  respond: (response: LedgerResponse) => void
}) => {
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const sign = async () => {
    setIsLoading(true)
    const signedTx = await signTransaction(message)

    if (signedTx.isOk()) {
      respond(createSignTxResponse(message, signedTx.value, ''))
    } else {
      setError(signedTx.error)
    }
    setIsLoading(false)
  }

  return (
    <>
      <PairingHeader header="Sign Transaction with Ledger Device">
        Please connect the following Ledger hardware wallet device to this
        computer and click Continue:
      </PairingHeader>
      <ErrorText error={error} />

      <Box textAlign="center" py="large">
        <Header>{message.ledgerDevice.name}</Header>
      </Box>

      <Button onClick={sign} disabled={isLoading}>
        Continue
      </Button>
    </>
  )
}