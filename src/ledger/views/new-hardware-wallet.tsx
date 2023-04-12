import { Button } from 'components'
import { ErrorText } from '../components/error-text'
import {
  createLedgerDeviceIdResponse,
  LedgerDeviceIdRequest,
  LedgerResponse,
} from 'ledger/schemas'
import { PairingHeader } from 'pairing/components/pairing-header'
import { useState } from 'react'
import { getDeviceInfo as ledgerGetDeviceInfo } from 'ledger/ledger-wrapper'

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
    setIsLoading(true)

    const deviceInfo = await ledgerGetDeviceInfo()

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
    }

    setIsLoading(false)
  }

  return (
    <>
      <PairingHeader header="New Hardware Wallet">
        Please connect a new Ledger Nano S or Nano X hardware wallet device to
        this computer and click Continue.
      </PairingHeader>

      <ErrorText error={error} />

      <Button full mt="large" onClick={getDeviceInfo} disabled={isLoading}>
        Continue
      </Button>
    </>
  )
}
