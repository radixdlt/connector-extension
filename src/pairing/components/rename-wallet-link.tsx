import { Modal, Box, Button } from 'components'
import { useState } from 'react'
import InfoOutline from '../assets/info-outline.svg'

const texts = {
  initialFlow: {
    header: 'Name Your Wallet',
    action: 'Confirm',
  },
  updateFlow: {
    header: 'Rename Wallet Link',
    action: 'Update',
  },
}

export const RenameWalletLink = (props: {
  initialValue: string
  cancel: () => void
  isInitial: boolean
  updateName: (name: string) => void
}) => {
  const text = texts[props.isInitial ? 'initialFlow' : 'updateFlow']
  const [currentName, setCurrentName] = useState(props.initialValue)
  const [isUpdateDisabled, setIsUpdateDisabled] = useState(true)

  return (
    <Modal header={text.header}>
      <input
        className="rename-wallet-link__input"
        type="text"
        value={currentName}
        onChange={(e) => {
          const value = e.target.value
          setCurrentName(value)
          setIsUpdateDisabled(!value || value === props.initialValue)
        }}
      />
      <div className="rename-wallet-link__error">
        {!currentName && (
          <>
            <img src={InfoOutline} />
            <span>Name cannot be empty</span>
          </>
        )}
      </div>
      <Box items="center" style={{ gap: '8px' }}>
        <Button secondary onClick={() => props.cancel()}>
          Cancel
        </Button>
        <Button
          disabled={isUpdateDisabled && !props.isInitial}
          onClick={() => props.updateName(currentName)}
          full
        >
          {text.action}
        </Button>
      </Box>
    </Modal>
  )
}
