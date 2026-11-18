import { useState } from 'react'
import { Dialog, DialogField } from 'ui/dialog'
import { EditIcon, PhoneIcon } from 'ui/icons'

const texts = {
  initialFlow: {
    header: 'Name Your Wallet',
    description: 'The wallet is linked. Give it a name to recognise it here.',
    action: 'Confirm',
    icon: <PhoneIcon />,
  },
  updateFlow: {
    header: 'Rename Wallet Link',
    description: 'The new name is only used in this browser.',
    action: 'Update',
    icon: <EditIcon />,
  },
}

/** Names a newly linked wallet, or renames a linked one. */
export const RenameWalletLink = (props: {
  initialValue: string
  cancel: () => void
  isInitial: boolean
  updateName: (name: string) => void
}) => {
  const text = texts[props.isInitial ? 'initialFlow' : 'updateFlow']
  const [currentName, setCurrentName] = useState(props.initialValue)
  const empty = !currentName.trim()
  // A new link may keep its proposed name; a rename must change it.
  const unchanged = !props.isInitial && currentName === props.initialValue

  return (
    <Dialog
      title={text.header}
      description={text.description}
      icon={text.icon}
      confirmLabel={text.action}
      confirmDisabled={empty || unchanged}
      onCancel={props.cancel}
      onConfirm={() => props.updateName(currentName.trim())}
    >
      <DialogField
        label="Wallet name"
        type="text"
        value={currentName}
        maxLength={64}
        placeholder="e.g. My phone"
        hint="For example, the phone it is on."
        error={empty ? 'Name cannot be empty' : undefined}
        onChange={(event) => setCurrentName(event.target.value)}
      />
    </Dialog>
  )
}
