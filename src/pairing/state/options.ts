import type { ConnectorExtensionOptions } from 'options'
import { getExtensionOptions } from 'options'
import { useEffect, useState } from 'react'
import { localStore } from 'chrome/helpers/storage'

export const useConnectorOptions = () => {
  const [connectorOptions, setConnectorOptions] =
    useState<ConnectorExtensionOptions>()

  useEffect(() => {
    getExtensionOptions().map((result) => setConnectorOptions(result))

    // As saved, like before: the next read merges the defaults.
    return localStore.onChange('options', (options) =>
      setConnectorOptions(options as ConnectorExtensionOptions | undefined),
    )
  }, [])

  return connectorOptions
}
