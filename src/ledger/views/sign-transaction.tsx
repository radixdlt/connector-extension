import { Button } from 'components'
import { ErrorText } from 'ledger/components/error-text'
import { LedgerDeviceBox } from 'ledger/components/ledger-device-box'
import { ledger } from 'ledger/ledger-wrapper'
import {
  LedgerResponse,
  LedgerSignTransactionRequest,
  createSignedTransactionResponse,
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
    const signedTx = await ledger.signTransaction(message)

    if (signedTx.isOk()) {
      respond(createSignedTransactionResponse(message, signedTx.value))
    } else {
      setError(signedTx.error)
      setIsLoading(false)
    }
  }

  return (
    <>
      <PairingHeader header="Sign Transaction with Ledger Device">
        Please connect the following Ledger hardware wallet device to this
        computer and click Continue:
      </PairingHeader>
      <ErrorText error={error} />

      <LedgerDeviceBox {...message.ledgerDevice} />
      {!isLoading && (
        <Button full onClick={sign}>
          Continue
        </Button>
      )}
    </>
  )
}
