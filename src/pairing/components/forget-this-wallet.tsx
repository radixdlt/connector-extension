import { Dialog } from 'ui/dialog'
import { DeleteIcon } from 'ui/icons'

export const ForgetThisWallet = (props: {
  forgetWallet: () => void
  cancel: () => void
}) => (
  <Dialog
    title="Forget This Wallet"
    description="This browser will no longer reach this wallet. You can link it again at any time with a new QR code."
    icon={<DeleteIcon />}
    tone="danger"
    confirmLabel="Forget"
    onCancel={props.cancel}
    onConfirm={props.forgetWallet}
  />
)
