import {
  getBackgroundClient,
  isPublicMethod,
} from './router/clients/background'
import * as v from 'valibot'

export const handleInboundMessage = async (event: Event) => {
  const { detail: incomingMessage } = event as CustomEvent

  const result = v.safeParse(
    v.objectWithRest({ discriminator: v.string() }, v.unknown()),
    incomingMessage,
  )

  // Only the background's public methods: any other message (a dApp request, its
  // cancel) was a call that always failed, a round trip to the background each time.
  if (result.success && isPublicMethod(result.output.discriminator)) {
    const backgroundClient = await getBackgroundClient()
    try {
      // trpc is throwing an internal error, however, it does not affect the functionality
      await backgroundClient(incomingMessage.discriminator)(incomingMessage)
    } catch (error) {}
  }
}
