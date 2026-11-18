import { ResultAsync } from 'neverthrow'
import { updateLocalStore } from 'chrome/helpers/storage'

// What the extension keeps about each linked wallet besides its connection: when
// it was linked and last used (for sorting), its picture and its place in the
// custom order.

export const recordWalletLinked = (walletPublicKey: string, at = Date.now()) =>
  updateLocalStore('walletActivity', {}, (activity) => ({
    ...activity,
    [walletPublicKey]: { ...activity[walletPublicKey], linkedAt: at },
  }))

/** The wallet answered a dApp. */
export const recordWalletUsed = (walletPublicKey: string, at = Date.now()) =>
  updateLocalStore('walletActivity', {}, (activity) => ({
    ...activity,
    [walletPublicKey]: { ...activity[walletPublicKey], lastUsedAt: at },
  }))

export const setWalletPicture = (
  walletPublicKey: string,
  picture: string | undefined,
) =>
  updateLocalStore('walletPictures', {}, (pictures) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omits the key from the rest
    const { [walletPublicKey]: _, ...others } = pictures
    return picture ? { ...others, [walletPublicKey]: picture } : others
  })

/** The wallet was forgotten: nothing of it is kept. */
export const forgetWalletRecords = (walletPublicKey: string) =>
  ResultAsync.combine([
    updateLocalStore('walletActivity', {}, (activity) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omits the key from the rest
      const { [walletPublicKey]: _, ...others } = activity
      return others
    }),
    setWalletPicture(walletPublicKey, undefined),
    updateLocalStore('walletOrder', [], (order) =>
      order.filter((id) => id !== walletPublicKey),
    ),
  ]).map(() => undefined)
