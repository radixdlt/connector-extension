import { Button } from 'components'
import { ErrorText } from 'ledger/components/error-text'
import { LedgerDeviceBox } from 'ledger/components/ledger-device-box'
import { ledger } from 'ledger/wrapper/ledger-wrapper'
import {
  LedgerSignTransactionRequest,
  LedgerSignTransactionResponse,
  createSignedResponse,
} from 'ledger/schemas'
import { PairingHeader } from 'pairing/components/pairing-header'
import { useContext, useState, useEffect, useCallback } from 'react'
import { MessagingContext } from 'ledger/contexts/messaging-context'

export const SignTransaction = ({
  message,
}: {
  message: LedgerSignTransactionRequest
}) => {
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const { respond } = useContext(MessagingContext)
  const sign = useCallback(async () => {
    setError(undefined)
    setIsLoading(true)
    const signedTx = await ledger.signTransaction(message)

    if (signedTx.isOk()) {
      respond(
        createSignedResponse(
          message,
          signedTx.value
        ) as LedgerSignTransactionResponse
      )
    } else {
      setError(signedTx.error)
      setIsLoading(false)
    }
  }, [message, respond])

  useEffect(() => {
    sign()
  }, [sign])

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
