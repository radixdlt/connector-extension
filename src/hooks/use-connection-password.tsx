import { useEffect, useState } from 'react'
import { useConnectionSecrets } from './use-connection-secrets'

export const useConnectionPassword = () => {
  const [connectionPassword, setConnectionPassword] = useState<
    string | undefined
  >(undefined)

  const connectionSecrets = useConnectionSecrets()

  useEffect(() => {
    if (!connectionSecrets) return
    else if (connectionSecrets.isErr()) setConnectionPassword('unset')
    else
      setConnectionPassword(
        connectionSecrets.value.encryptionKey.toString('hex')
      )
  }, [connectionSecrets])

  return connectionPassword
}
