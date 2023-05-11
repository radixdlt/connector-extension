import { Button } from 'components'
import { LedgerDeviceBox } from 'ledger/components/ledger-device-box'
import { LedgerSignChallengeRequest } from 'ledger/schemas'
import { PairingHeader } from 'pairing/components/pairing-header'

export const SignChallenge = ({
  message,
}: {
  message: LedgerSignChallengeRequest
}) => (
  <>
    <PairingHeader header="Sign Challenge with Ledger Device">
      Please connect the following Ledger hardware wallet device to this
      computer and click Continue:
    </PairingHeader>
    <LedgerDeviceBox {...message.ledgerDevice} />
    <Button>Continue</Button>
  </>
)
