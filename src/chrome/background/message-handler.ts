import { closePopup as closePopupFn } from 'chrome/helpers/close-popup'
import { openParingPopup as openParingPopupFn } from 'chrome/helpers/open-pairing-popup'
import { errAsync, ResultAsync } from 'neverthrow'
import { AppLogger } from 'utils/logger'
import {
  messageDiscriminator,
  Message,
  SendMessageWithConfirmation,
  MessageHandlerOutput,
} from '../messages/_types'
import { getConnectionPassword as getConnectionPasswordFn } from '../helpers/get-connection-password'

export type BackgroundMessageHandler = ReturnType<
  typeof BackgroundMessageHandler
>
export const BackgroundMessageHandler =
  ({
    logger,
    getConnectionPassword = getConnectionPasswordFn,
    closePopup = closePopupFn,
    openParingPopup = openParingPopupFn,
  }: Partial<{
    logger: AppLogger
    getConnectionPassword: () => ResultAsync<any, Error>
    closePopup: () => ResultAsync<any, Error>
    openParingPopup: () => ResultAsync<any, Error>
  }>) =>
  (
    message: Message,
    sendMessageWithConfirmation: SendMessageWithConfirmation
  ): MessageHandlerOutput => {
    switch (message.discriminator) {
      case messageDiscriminator.getConnectionPassword:
        return getConnectionPassword()
          .mapErr((error) => ({
            reason: 'failedToGetConnectionPassword',
            jsError: error,
          }))
          .map((connectionPassword) => ({
            sendConfirmation: true,
            data: { connectionPassword },
          }))

      case messageDiscriminator.detectWalletLink:
        return getConnectionPassword()
          .andThen((connectionPassword) =>
            connectionPassword
              ? closePopup().map(() => !!connectionPassword)
              : openParingPopup().map(() => !!connectionPassword)
          )
          .map((isLinked) => ({
            sendConfirmation: true,
            data: { isLinked },
          }))
          .mapErr((error) => ({
            reason: 'failedToDetectWalletLink',
            jsError: error,
          }))

      case messageDiscriminator.sendMessageToTab: {
        return sendMessageWithConfirmation(
          { ...message.data, source: 'background' },
          message.tabId
        ).map(() => ({
          sendConfirmation: true,
        }))
      }

      default:
        return errAsync({
          reason: 'unhandledMessageDiscriminator',
        })
    }
  }
