/* eslint-disable max-nested-callbacks */
import { Box } from 'components'
import { useConnector } from 'hooks/use-connector'
import { useEffect, useState } from 'react'
import { PreviewMessage } from './preview-message'
import { MessageActions } from './message-actions'

export const Message = () => {
  const connector = useConnector()

  const [message, setMessage] = useState<
    { message: any; formatted: string } | undefined
  >()

  useEffect(() => {
    if (!connector) return

    const subscription = connector.message$.subscribe((result) => {
      result.map((message) =>
        setMessage({ message, formatted: JSON.stringify(message, null, 2) })
      )
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [connector])

  if (!message) return null

  return (
    <Box>
      <PreviewMessage text={message.formatted} />
      <MessageActions
        message={message.message}
        clearMessage={() => setMessage(undefined)}
      />
    </Box>
  )
}
