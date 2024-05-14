import { chromeLocalStore } from 'chrome/helpers/chrome-local-store'
import { Warning } from 'components/warning/warning'
import { useEffect, useState } from 'react'

export const RelinkWarning = () => {
  const [oldConnection, setOldConnection] = useState<string>()
  useEffect(() => {
    chromeLocalStore.getItem('connectionPassword').map((result) => {
      setOldConnection(result.connectionPassword)
    })
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (changes['connectionPassword']) {
        setOldConnection(changes['connectionPassword'].newValue)
      }
    }
    chrome.storage.onChanged.addListener(listener)

    return () => {
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [])
  return oldConnection ? (
    <>
      <Warning
        header="Your Connector has been updated"
        subheader=" Please re-link your Radix Wallet"
      ></Warning>
    </>
  ) : null
}
