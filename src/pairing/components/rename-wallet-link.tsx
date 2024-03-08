import { Modal, Box, Button } from 'components'
import { useState } from 'react'
import InfoOutline from '../assets/info-outline.svg'
export const RenameWalletLink = (props: {
  initialValue: string
  cancel: () => void
  updateName: (name: string) => void
}) => {
  const [currentName, setCurrentName] = useState(props.initialValue)
  const [isUpdateDisabled, setIsUpdateDisabled] = useState(true)

  return (
    <Modal header="Rename Wallet Link">
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
          disabled={isUpdateDisabled}
          onClick={() => props.updateName(currentName)}
          full
        >
          Update
        </Button>
      </Box>
    </Modal>
  )
}
