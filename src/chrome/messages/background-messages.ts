import { closePopup } from 'chrome/helpers/close-popup'
import { openParingPopup } from 'chrome/helpers/open-pairing-popup'
import { sendMessage } from 'chrome/helpers/send-message'
import { errAsync } from 'neverthrow'
import { getConnectionPassword } from '../helpers/get-connection-password'
import { sendMessageToTab } from '../helpers/send-message-to-tab'
import { createMessage } from './create-message'
import { BackgroundMessage, messageDiscriminator } from './_types'

export type BackgroundMessageHandler = ReturnType<
  typeof BackgroundMessageHandler
>
export const BackgroundMessageHandler =
  () => (backgroundMessage: BackgroundMessage) => {
    switch (backgroundMessage.discriminator) {
      case messageDiscriminator.getConnectionPassword:
        return getConnectionPassword().andThen((connectionPassword) =>
          sendMessage(
            createMessage.connectionPasswordChange(connectionPassword)
          )
        )

      case messageDiscriminator.sendMessageToTab:
        return sendMessageToTab(
          backgroundMessage.tabId,
          createMessage.walletResponse(backgroundMessage.data)
        )

      case messageDiscriminator.detectWalletLink:
        return getConnectionPassword().andThen((isLinked) =>
          isLinked ? closePopup() : openParingPopup()
        )

      default:
        return errAsync(new Error('Unhandled message discriminator'))
    }
  }
