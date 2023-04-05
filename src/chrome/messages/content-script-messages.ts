import { ChromeDAppClient } from 'chrome/chrome-dapp-client'
import { errAsync } from 'neverthrow'
import { ContentScriptMessage, messageDiscriminator } from './_types'

export type ContentScriptMessageHandler = ReturnType<
  typeof ContentScriptMessageHandler
>
export const ContentScriptMessageHandler =
  (dAppClient: ChromeDAppClient) =>
  (contentScriptMessage: ContentScriptMessage) => {
    switch (contentScriptMessage.discriminator) {
      case messageDiscriminator.walletResponse:
        return dAppClient.sendMessage(contentScriptMessage.data)

      default:
        return errAsync(new Error('Unhandled message discriminator'))
    }
  }
