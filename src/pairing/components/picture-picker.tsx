import { useRef, useState } from 'react'
import { setWalletPicture } from 'pairing/state/wallet-records'
import { pictureFromFile } from 'ui/picture'

/**
 * Chooses a wallet's picture from a file: `choose` opens the file picker, `fileInput`
 * is its hidden input and `notice` says why a file could not be used.
 */
export const usePicturePicker = () => {
  const input = useRef<HTMLInputElement>(null)
  const choosingFor = useRef<string>()
  const [error, setError] = useState<string>()

  const choose = (walletPublicKey: string) => {
    choosingFor.current = walletPublicKey
    input.current?.click()
  }

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      hidden
      onChange={(event) => {
        const file = event.target.files?.[0]
        const walletPublicKey = choosingFor.current
        event.target.value = ''
        if (!file || !walletPublicKey) return
        setError(undefined)
        pictureFromFile(file)
          .andThen((picture) => setWalletPicture(walletPublicKey, picture))
          .mapErr((failure) => setError(failure.message))
      }}
    />
  )

  const notice = error && (
    <p className="main-view__notice" role="alert">
      Could not use that picture: {error}
    </p>
  )

  return { choose, fileInput, notice }
}
