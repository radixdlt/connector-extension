import { getBackgroundClient } from './router/clients/background'
import * as v from 'valibot'

export const handleInboundMessage = async (event: Event) => {
  const { detail: incomingMessage } = event as CustomEvent

  const backgroundClient = await getBackgroundClient()

  const result = v.safeParse(
    v.objectWithRest({ discriminator: v.string() }, v.unknown()),
    incomingMessage,
  )

  if (result.success) {
    try {
      // trpc is throwing an internal error, however, it does not affect the functionality
      await backgroundClient(incomingMessage.discriminator)(incomingMessage)
    } catch (error) {}
  }
}
