import { localStore } from 'chrome/helpers/storage'
import { Warning } from 'components/warning/warning'
import { useEffect, useState } from 'react'

export const RelinkWarning = () => {
  const [oldConnection, setOldConnection] = useState<string>()
  useEffect(() => {
    localStore.get('connectionPassword').map(setOldConnection)
    return localStore.onChange('connectionPassword', setOldConnection)
  }, [])
  return oldConnection ? (
    <Warning header="Please update your Radix Wallet to version 1.6 (or newer) and re-link" />
  ) : null
}
