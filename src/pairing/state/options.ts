import { ConnectorExtensionOptions, getExtensionOptions } from 'options'
import { useEffect, useState } from 'react'

export const useConnectorOptions = () => {
  const [connectorOptions, setConnectorOptions] =
    useState<ConnectorExtensionOptions>()

  useEffect(() => {
    getExtensionOptions().map((result) => setConnectorOptions(result))

    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (changes['options'] && area === 'local') {
        setConnectorOptions(changes['options'].newValue)
      }
    }

    chrome.storage.onChanged.addListener(listener)

    return () => {
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [])

  return connectorOptions
}
