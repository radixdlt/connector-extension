import { Box, Button, Header } from 'components'
import { LedgerResponse, LedgerSignChallengeRequest } from 'ledger/schemas'
import { PairingHeader } from 'pairing/components/pairing-header'

export const SignChallenge = ({
  message,
  respond,
}: {
  message: LedgerSignChallengeRequest
  respond: (response: LedgerResponse) => void
}) => (
  <>
    <PairingHeader header="Sign Challenge with Ledger Device">
      Please connect the following Ledger hardware wallet device to this
      computer and click Continue:
    </PairingHeader>
    <Box textAlign="center" py="large">
      <Header>{message.ledgerDevice.name}</Header>
    </Box>
    <Button>Continue</Button>
  </>
)
