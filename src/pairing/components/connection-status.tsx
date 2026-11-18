import { PendingRequests } from 'requests/pending-requests'
import { CountBadge } from 'requests/request-card'
import { useEffect, useState } from 'react'
import { useLocalStore } from 'chrome/helpers/use-local-store'
import { useSurface } from 'side-panel/surface'
import {
  defaultWalletSort,
  moveWallet,
  sortWallets,
} from 'pairing/state/wallet-order'
import { setWalletPicture } from 'pairing/state/wallet-records'
import { useWalletDrag } from 'pairing/state/use-wallet-drag'
import { openWalletPictureWindow } from './wallet-picture'
import { usePicturePicker } from './picture-picker'
import { LinkedWallet } from 'components/linked-wallet/linked-wallet'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  useConnectionsClient,
  type ConnectionsClient,
} from 'pairing/state/connections'
import { ForgetThisWallet } from './forget-this-wallet'
import { RenameWalletLink } from './rename-wallet-link'
import { useWalletTransportStatus } from 'pairing/state/wallet-transport-status'
import { shortWalletKey } from 'chrome/offscreen/wallet-connection/transport/diagnostics'
import { PlusIcon } from 'ui/icons'

/**
 * A wallet just linked, from the page's address (`newWallet`), shown as such; a new
 * one (not `isKnownConnection`) is asked for its name. Read once, then cleared.
 */
const useNewlyLinkedWallet = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [changingName, setChangingName] = useState<
    { walletPublicKey: string; isInitial: boolean } | undefined
  >(undefined)
  const [recentlyLinkedWallet, setRecentlyLinkedWallet] = useState<
    string | undefined
  >(undefined)

  useEffect(() => {
    if (searchParams.has('newWallet')) {
      const newWalletPublicKey = searchParams.get('newWallet') as string
      const isKnownWallet = searchParams.get('isKnownConnection') === 'true'
      setRecentlyLinkedWallet(newWalletPublicKey)
      setChangingName(
        !isKnownWallet
          ? { walletPublicKey: newWalletPublicKey, isInitial: true }
          : undefined,
      )

      setSearchParams({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the search params change
  }, [searchParams])

  return { recentlyLinkedWallet, changingName, setChangingName }
}

/**
 * The linked wallets in the order chosen in the settings (custom by default), and
 * how to move one: moving makes the order shown the custom one, with that change.
 */
const useSortedWallets = (
  entries: ReturnType<ConnectionsClient['entries']>,
  isConnected: (walletPublicKey: string) => boolean,
) => {
  const [sort, setSort] = useLocalStore('walletSort', defaultWalletSort)
  const [order, setOrder] = useLocalStore('walletOrder', [])
  const [activity] = useLocalStore('walletActivity', {})
  const wallets = sortWallets(entries, {
    sort: sort ?? defaultWalletSort,
    order,
    activity,
    isConnected,
  })
  const walletIds = wallets.map(([id]) => id)

  // Shown at once (then saved): no frame shows the old order.
  const move = (from: number, to: number) => {
    setOrder(moveWallet(walletIds, from, to))
    if (sort !== 'custom') setSort('custom')
  }

  return { wallets, walletIds, move }
}

/**
 * Main user facing interface
 */
export const ConnectionStatus = () => {
  const navigate = useNavigate()
  const connectionsClient = useConnectionsClient()
  const connections = connectionsClient.connections
  // Polled only while the popup is open.
  const transportStatuses = useWalletTransportStatus()

  const [connectionIdToForget, setConnectionIdToForget] = useState<string>('')
  const { recentlyLinkedWallet, changingName, setChangingName } =
    useNewlyLinkedWallet()

  useEffect(() => {
    if (connectionsClient.isLoading()) return
    if (!connectionsClient.hasConnections()) {
      navigate('/pairing')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-checked only when connections change
  }, [connections])

  const { wallets, walletIds, move } = useSortedWallets(
    connectionsClient.entries(),
    (id) => !!transportStatuses[shortWalletKey(id)]?.connected,
  )
  const [pictures] = useLocalStore('walletPictures', {})
  const [showPictures] = useLocalStore('showWalletPictures', true)
  const dragPropsOf = useWalletDrag(walletIds, move)

  // The popup closes when the file picker takes the focus: from there, pictures
  // are chosen in a small window of their own.
  const surface = useSurface()
  const picturePicker = usePicturePicker()
  const choosePicture = (walletPublicKey: string) => {
    if (surface === 'popup') {
      openWalletPictureWindow(walletPublicKey)
      return
    }
    picturePicker.choose(walletPublicKey)
  }

  const forgetWallet = () => {
    connectionsClient.remove(connectionIdToForget)
    setConnectionIdToForget('')
  }

  const updateWalletName = (walletName: string) => {
    if (changingName) {
      connectionsClient.updateName(walletName, changingName.walletPublicKey)
      setChangingName(undefined)
    }
  }

  const renderForgetWalletConfirmation = () => {
    if (!connectionIdToForget) return null

    return (
      <ForgetThisWallet
        forgetWallet={forgetWallet}
        cancel={() => setConnectionIdToForget('')}
      />
    )
  }

  const renderChangeWalletName = () => {
    if (!changingName || !connections) return null

    return (
      <RenameWalletLink
        cancel={() => setChangingName(undefined)}
        updateName={(updatedName) => updateWalletName(updatedName)}
        isInitial={changingName.isInitial}
        initialValue={connections[changingName.walletPublicKey].walletName}
      />
    )
  }

  return connectionsClient.hasConnections() ? (
    <>
      <div
        className="main-view"
        style={
          connectionIdToForget || changingName
            ? { filter: 'blur(10px)' }
            : undefined
        }
      >
        <h1 className="main-view__title">Radix Wallet Connector</h1>
        {/* Takes the height left (popup or side panel) and scrolls. */}
        <div className="main-view__content">
          <PendingRequests />
          <h2 className="main-view__section-title">
            Linked wallets
            <CountBadge count={wallets.length} className="main-view__count" />
          </h2>
          {picturePicker.notice}
          <div
            className={`linked-wallets${
              wallets.length > 1 ? ' linked-wallets--sortable' : ''
            }`}
          >
            {wallets.map(([id, connection], index) => (
              <div
                key={id}
                className="linked-wallets__slot"
                {...(wallets.length > 1 ? dragPropsOf(id) : {})}
              >
                <LinkedWallet
                  isJustLinked={recentlyLinkedWallet === id}
                  transportStatus={transportStatuses[shortWalletKey(id)]}
                  accounts={connection.accounts}
                  name={connection.walletName}
                  onForgetWallet={() => setConnectionIdToForget(id)}
                  onRenameWalletLink={() =>
                    setChangingName({ walletPublicKey: id, isInitial: false })
                  }
                  picture={pictures?.[id]}
                  showPicture={showPictures !== false}
                  onChoosePicture={() => choosePicture(id)}
                  onRemovePicture={() => setWalletPicture(id, undefined)}
                  onMoveUp={
                    index > 0 ? () => move(index, index - 1) : undefined
                  }
                  onMoveDown={
                    index < wallets.length - 1
                      ? () => move(index, index + 1)
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
          {picturePicker.fileInput}
        </div>
        <div className="main-view__footer">
          <Link to="/pairing" className="main-view__button">
            <PlusIcon />
            Link New Wallet
          </Link>
        </div>
      </div>
      {renderForgetWalletConfirmation()}
      {renderChangeWalletName()}
    </>
  ) : null
}
