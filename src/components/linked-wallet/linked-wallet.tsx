import './linked-wallet.scss'
import { SharedAccounts } from './shared-accounts'
import type { Account } from '@radixdlt/radix-dapp-toolkit'
import type { WalletTransportStatus } from 'pairing/state/wallet-transport-status'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  ImageIcon,
  MoreIcon,
  PhoneIcon,
} from 'ui/icons'
import { MenuButton, type MenuItem } from 'ui/menu'

/**
 * How the extension is connected to the wallet: a dot and a line of text ("Connected
 * via iroh", "Not connected"), said in text, not with the colour alone. Its line
 * stays while the status is unknown, so that nothing moves when it arrives.
 */
export const TransportStatus = ({
  status,
}: {
  status?: WalletTransportStatus
}) => (
  <span
    className={
      status
        ? `linked-wallet__status${
            status.connected ? ' linked-wallet__status--connected' : ''
          }`
        : 'linked-wallet__status linked-wallet__status--unknown'
    }
    data-testid="transport-status"
    title={
      status &&
      (status.connected
        ? `Connected via ${status.label}`
        : 'Not connected to this wallet')
    }
  >
    {status &&
      (status.connected ? `Connected via ${status.label}` : status.label)}
  </span>
)

/** What a card can do besides its own menu: set by the list it is in. */
export type LinkedWalletActions = {
  /** Its picture, if one was chosen. */
  picture?: string
  /** Whether cards show a picture (the chosen one, or a phone). */
  showPicture?: boolean
  /** Opens a way to choose a picture (a file picker, or a window for it). */
  onChoosePicture?: () => void
  onRemovePicture?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

/**
 * A linked wallet, in two parts: who it is (its picture, which can be changed)
 * and how it is connected, with its menu; then the accounts it shares.
 */
export const LinkedWallet = ({
  name,
  accounts,
  isJustLinked,
  transportStatus,
  onRenameWalletLink,
  onForgetWallet,
  picture,
  showPicture = true,
  onChoosePicture,
  onRemovePicture,
  onMoveUp,
  onMoveDown,
}: {
  name: string
  isJustLinked: boolean
  transportStatus?: WalletTransportStatus
  accounts: Account[]
  onRenameWalletLink: () => void
  onForgetWallet: () => void
} & LinkedWalletActions) => {
  const menuItems: MenuItem[] = [
    {
      label: 'Rename Wallet Link',
      icon: <EditIcon />,
      onSelect: onRenameWalletLink,
    },
  ]
  if (showPicture && onChoosePicture)
    menuItems.push({
      label: picture ? 'Change Picture' : 'Choose Picture',
      icon: <ImageIcon />,
      onSelect: onChoosePicture,
    })
  if (showPicture && picture && onRemovePicture)
    menuItems.push({
      label: 'Remove Picture',
      icon: <CloseIcon />,
      onSelect: onRemovePicture,
    })
  if (onMoveUp)
    menuItems.push({
      label: 'Move Up',
      icon: <ArrowUpIcon />,
      onSelect: onMoveUp,
    })
  if (onMoveDown)
    menuItems.push({
      label: 'Move Down',
      icon: <ArrowDownIcon />,
      onSelect: onMoveDown,
    })
  menuItems.push({
    label: 'Forget Wallet',
    icon: <DeleteIcon />,
    tone: 'danger',
    onSelect: onForgetWallet,
  })

  return (
    <article className="linked-wallet" aria-label={name}>
      <div className="linked-wallet__header">
        {showPicture &&
          (onChoosePicture ? (
            <button
              type="button"
              className={`linked-wallet__icon${
                picture ? ' linked-wallet__icon--picture' : ''
              }`}
              aria-label={`Choose a picture for ${name}`}
              title="Choose a picture"
              onClick={onChoosePicture}
            >
              <WalletPicture picture={picture} />
            </button>
          ) : (
            <span
              className={`linked-wallet__icon${
                picture ? ' linked-wallet__icon--picture' : ''
              }`}
              aria-hidden="true"
            >
              <WalletPicture picture={picture} />
            </span>
          ))}
        <div className="linked-wallet__identity">
          <h3 className="linked-wallet__name">{name}</h3>
          <TransportStatus status={transportStatus} />
        </div>
        <MenuButton
          className="linked-wallet__menu-button"
          label={`Options for ${name}`}
          title="Options"
          items={menuItems}
        >
          <MoreIcon />
        </MenuButton>
      </div>
      <SharedAccounts accounts={accounts} isJustLinked={isJustLinked} />
    </article>
  )
}

/** The chosen picture, or the phone of a wallet that has none. */
export const WalletPicture = ({ picture }: { picture?: string }) =>
  picture ? (
    <img className="linked-wallet__picture" src={picture} alt="" />
  ) : (
    <PhoneIcon />
  )
