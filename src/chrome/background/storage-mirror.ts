import { config } from 'config'
import { closePopup } from '../helpers/close-popup'
import { createMessage } from '../messages/create-message'
import type { MessageClient } from '../messages/message-client'
import { messageSource } from 'chrome/messages/_types'
import { localStore } from 'chrome/helpers/storage'
import { getExtensionOptions } from 'options'
import {
  activeRetiredLinks,
  pruneRetiredLinks,
} from 'chrome/links/retired-links'
import type { Connections } from 'pairing/state/connections'

/**
 * The offscreen document cannot read the storage: what it keeps of it (the wallet
 * links, the options, the notices of forgotten links, the dApp sessions) is given to
 * it again whenever it changes. It asks for it when it starts (see
 * `OffscreenInitializationMessages`).
 */
export const mirrorStorageToOffscreen = (messageHandler: MessageClient) => {
  const handleConnectionsChange = (connections?: Connections) =>
    messageHandler
      .sendMessageAndWaitForConfirmation(
        createMessage.setConnections('background', connections || {}),
      )
      .map(() => {
        setTimeout(() => {
          closePopup()
        }, config.popup.closeDelayTime)
      })

  localStore.onChange('connections', (connections) =>
    handleConnectionsChange(connections),
  )
  // Read back as the offscreen document reads them at start: with the defaults of
  // missing options.
  localStore.onChange('options', () =>
    getExtensionOptions().andThen((options) =>
      messageHandler.sendMessageAndWaitForConfirmation(
        createMessage.setConnectorExtensionOptions('background', options),
      ),
    ),
  )
  // The notices for the wallets of forgotten links: delivered by the offscreen
  // document, which holds the links. Expired ones are forgotten at start.
  localStore.onChange('retiredLinks', (links) =>
    messageHandler.sendMessageAndWaitForConfirmation(
      createMessage.setRetiredLinks('background', activeRetiredLinks(links)),
    ),
  )
  pruneRetiredLinks()
  localStore.onChange('sessionRouter', (sessionRouter) =>
    messageHandler.sendMessageAndWaitForConfirmation(
      createMessage.setSessionRouterData(
        sessionRouter ?? {},
        messageSource.background,
      ),
    ),
  )
}
