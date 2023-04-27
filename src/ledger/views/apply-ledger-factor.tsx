import { Button } from 'components'
import { ErrorText } from '../components/error-text'
import {
  createLedgerPublicKeyResponse,
  LedgerPublicKeyRequest,
  LedgerResponse,
} from 'ledger/schemas'
import { PairingHeader } from 'pairing/components/pairing-header'
import { useState } from 'react'
import { LedgerDeviceBox } from 'ledger/components/ledger-device-box'
import { ledger } from 'ledger/wrapper/ledger-wrapper'

const EntityType = {
  Account: '525',
  Identity: '618',
} as const

export const ApplyLedgerFactor = ({
  message,
  respond,
}: {
  message: LedgerPublicKeyRequest
  respond: (response: LedgerResponse) => void
}) => {
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const header = message.keyParameters.derivationPath
    .split('/')[4]
    .includes(EntityType.Account)
    ? 'Apply Ledger Factor to Account Security'
    : 'Apply Ledger Factor to Persona Security'

  const getPublicKey = async () => {
    setError(undefined)
    setIsLoading(true)
    const publicKey = await ledger.getPublicKey(message)

    if (publicKey.isOk()) {
      respond(createLedgerPublicKeyResponse(message, publicKey.value))
    } else {
      setError(publicKey.error)
      setIsLoading(false)
    }
  }
  return (
    <>
      <PairingHeader header={header}>
        Please connect the following Ledger hardware wallet device to this
        computer and click Continue:
      </PairingHeader>

      <ErrorText error={error} />
      <LedgerDeviceBox {...message.ledgerDevice} />
      {!isLoading && (
        <Button full onClick={getPublicKey}>
          Continue
        </Button>
      )}
    </>
  )
}
