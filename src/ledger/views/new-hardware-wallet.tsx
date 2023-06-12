import { Button } from 'components'
import { ErrorText } from '../components/error-text'
import {
  createLedgerDeviceIdResponse,
  LedgerDeviceIdRequest,
} from 'ledger/schemas'
import { PairingHeader } from 'pairing/components/pairing-header'
import { useContext, useEffect, useState, useCallback } from 'react'
import { ledger } from 'ledger/wrapper/ledger-wrapper'
import { MessagingContext } from 'ledger/contexts/messaging-context'

export const NewHardwareWallet = ({
  message,
}: {
  message: LedgerDeviceIdRequest
}) => {
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const { respond } = useContext(MessagingContext)
  const getDeviceInfo = useCallback(async () => {
    setError(undefined)
    setIsLoading(true)

    const deviceInfo = await ledger.getDeviceInfo()

    if (deviceInfo.isOk()) {
      respond(
        createLedgerDeviceIdResponse(
          message,
          deviceInfo.value.deviceId,
          deviceInfo.value.model
        )
      )
    } else {
      setError(deviceInfo.error)
      setIsLoading(false)
    }
  }, [message, respond])

  useEffect(() => {
    getDeviceInfo()
  }, [getDeviceInfo])

  return (
    <>
      <PairingHeader header="New Hardware Wallet">
        Please connect a new Ledger Nano S or Nano X hardware wallet device to
        this computer and click retry
      </PairingHeader>

      <ErrorText error={error} />
      {!isLoading && (
        <Button full mt="large" onClick={getDeviceInfo}>
          Retry
        </Button>
      )}
    </>
  )
}
