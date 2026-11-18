import { useParams } from 'react-router-dom'
import { useLocalStore } from 'chrome/helpers/use-local-store'
import { useConnectionsClient } from 'pairing/state/connections'
import { setWalletPicture } from 'pairing/state/wallet-records'
import { WalletPicture } from 'components/linked-wallet/linked-wallet'
import { ImageIcon } from 'ui/icons'
import { usePicturePicker } from './picture-picker'

const route = 'wallet-picture'

/** The path of the screen that chooses the picture of a wallet. */
export const walletPicturePath = `/${route}/:walletPublicKey`

/**
 * Opens the picture screen of a wallet in a small window: from the popup, which
 * closes as soon as a file picker takes the focus.
 */
export const openWalletPictureWindow = (walletPublicKey: string) =>
  chrome.windows.create({
    url: chrome.runtime.getURL(
      `src/pairing/index.html#/${route}/${walletPublicKey}`,
    ),
    type: 'popup',
    // Room for the window's title bar above the screen.
    width: 380,
    height: 600,
  })

/** Chooses, changes or removes the picture of a wallet, then closes. */
export const WalletPictureScreen = () => {
  const { walletPublicKey = '' } = useParams()
  const connections = useConnectionsClient().connections
  const [pictures] = useLocalStore('walletPictures', {})
  const picturePicker = usePicturePicker()
  const picture = pictures?.[walletPublicKey]
  const name = connections?.[walletPublicKey]?.walletName ?? 'Wallet'

  return (
    <div className="main-view wallet-picture">
      <h1 className="pairing__title">Wallet Picture</h1>
      <div className="wallet-picture__preview">
        <span
          className={`linked-wallet__icon wallet-picture__avatar${
            picture ? ' linked-wallet__icon--picture' : ''
          }`}
        >
          <WalletPicture picture={picture} />
        </span>
        <p className="wallet-picture__name">{name}</p>
      </div>
      {picturePicker.notice}
      <div className="main-view__footer wallet-picture__actions">
        <button
          type="button"
          className="main-view__button"
          onClick={() => picturePicker.choose(walletPublicKey)}
        >
          <ImageIcon />
          {picture ? 'Change Picture' : 'Choose Picture'}
        </button>
        {picture && (
          <button
            type="button"
            className="main-view__button main-view__button--secondary"
            onClick={() => setWalletPicture(walletPublicKey, undefined)}
          >
            Remove Picture
          </button>
        )}
        <button
          type="button"
          className="main-view__button main-view__button--secondary"
          onClick={() => window.close()}
        >
          Done
        </button>
      </div>
      {picturePicker.fileInput}
    </div>
  )
}
