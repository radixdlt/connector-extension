import { Button } from 'components'
import { ErrorText } from '../components/error-text'
import {
  createLedgerDeviceIdResponse,
  LedgerDeviceIdRequest,
  LedgerResponse,
} from 'ledger/schemas'
import { PairingHeader } from 'pairing/components/pairing-header'
import { useState } from 'react'
import { ledger } from 'ledger/wrapper/ledger-wrapper'

export const NewHardwareWallet = ({
  message,
  respond,
}: {
  message: LedgerDeviceIdRequest
  respond: (response: LedgerResponse) => void
}) => {
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const getDeviceInfo = async () => {
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
  }

  return (
    <>
      <PairingHeader header="New Hardware Wallet">
        Please connect a new Ledger Nano S or Nano X hardware wallet device to
        this computer and click Continue.
      </PairingHeader>

      <ErrorText error={error} />
      {!isLoading && (
        <Button full mt="large" onClick={getDeviceInfo}>
          Continue
        </Button>
      )}
    </>
  )
}
