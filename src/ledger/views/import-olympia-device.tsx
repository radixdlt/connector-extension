import { Button } from 'components'
import { ErrorText } from '../components/error-text'
import {
  LedgerImportOlympiaDeviceRequest,
  createLedgerOlympiaDeviceResponse,
} from 'ledger/schemas'
import { PairingHeader } from 'pairing/components/pairing-header'
import { useCallback, useContext, useEffect, useState } from 'react'
import { ledger } from 'ledger/wrapper/ledger-wrapper'
import { MessagingContext } from 'ledger/contexts/messaging-context'

export const ImportOlympiaDevice = ({
  message,
}: {
  message: LedgerImportOlympiaDeviceRequest
}) => {
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const { respond } = useContext(MessagingContext)

  const importOlympiaFromLedger = useCallback(async () => {
    setError(undefined)
    setIsLoading(true)
    const olympiaDevice = await ledger.getOlympiaDeviceInfo(message)
    if (olympiaDevice.isOk()) {
      respond(createLedgerOlympiaDeviceResponse(message, olympiaDevice.value))
    } else {
      setError(olympiaDevice.error)
      setIsLoading(false)
    }
  }, [message, respond])

  useEffect(() => {
    importOlympiaFromLedger()
  }, [importOlympiaFromLedger])

  return (
    <>
      <PairingHeader header="Import Olympia Device">
        Please connect a Ledger Device which was used to manage Olympia accounts
      </PairingHeader>

      <ErrorText error={error} />

      {!isLoading && (
        <Button full mt="large" onClick={importOlympiaFromLedger}>
          Continue
        </Button>
      )}
    </>
  )
}
