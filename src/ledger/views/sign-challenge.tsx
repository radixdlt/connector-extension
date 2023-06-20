import { Button } from 'components'
import { ErrorText } from 'ledger/components/error-text'
import { LedgerDeviceBox } from 'ledger/components/ledger-device-box'
import { MessagingContext } from 'ledger/contexts/messaging-context'
import {
  LedgerSignChallengeRequest,
  LedgerSignChallengeResponse,
  createLedgerErrorResponse,
  createSignedResponse,
} from 'ledger/schemas'
import { LedgerErrorCode } from 'ledger/wrapper/constants'
import { ledger } from 'ledger/wrapper/ledger-wrapper'
import { PairingHeader } from 'pairing/components/pairing-header'
import { useContext, useEffect, useState, useCallback } from 'react'

export const SignChallenge = ({
  message,
}: {
  message: LedgerSignChallengeRequest
}) => {
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const { respond } = useContext(MessagingContext)
  const sign = useCallback(async () => {
    setError(undefined)
    setIsLoading(true)
    const signedTx = await ledger.signAuth(message)

    if (signedTx.isOk()) {
      respond(
        createSignedResponse(
          message,
          signedTx.value
        ) as LedgerSignChallengeResponse
      )
    } else {
      if (signedTx.error === LedgerErrorCode.BadTxSignUserRejected) {
        respond(createLedgerErrorResponse(message, 'BadTxSignUserRejected'))
      }
      setError(signedTx.error)
      setIsLoading(false)
    }
  }, [message, respond])

  useEffect(() => {
    sign()
  }, [sign])

  return (
    <>
      <PairingHeader header="Sign Challenge with Ledger Device">
        Please connect the following Ledger hardware wallet device to this
        computer and click retry
      </PairingHeader>
      <ErrorText error={error} />
      <LedgerDeviceBox {...message.ledgerDevice} />
      {!isLoading && (
        <Button full onClick={sign}>
          Retry
        </Button>
      )}
    </>
  )
}
