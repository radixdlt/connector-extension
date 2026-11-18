import { useEffect, useState } from 'react'
import { config } from 'config'
import type { WalletConnectionDiagnostics } from 'chrome/offscreen/wallet-connection/transport/diagnostics'
import { createMessage } from 'chrome/messages/create-message'
import type { Message } from 'chrome/messages/_types'
import { requestFromOffscreen } from 'chrome/helpers/request-from-offscreen'
import { isExtensionPage } from 'chrome/messages/trusted-senders'
import type { LinkStatuses } from 'chrome/offscreen/link-statuses'

export type WalletTransportStatus = {
  connected: boolean
  label: 'iroh' | 'WebRTC' | 'Not connected'
}

/**
 * The transport carrying a wallet's connection: the one the next message goes
 * through (iroh while it is connected, unless it just failed to deliver one).
 */
export const transportStatusOf = (
  connection: WalletConnectionDiagnostics,
): WalletTransportStatus =>
  statusOfLink(
    connection.sendingVia ??
      (connection.iroh?.connected
        ? 'iroh'
        : connection.webRtc?.connected
        ? 'webrtc'
        : 'none'),
  )

/** A link's status from the offscreen document, as its wallet card shows it. */
export const statusOfLink = (
  via: LinkStatuses[string],
): WalletTransportStatus =>
  via === 'iroh'
    ? { connected: true, label: 'iroh' }
    : via === 'webrtc'
    ? { connected: true, label: 'WebRTC' }
    : { connected: false, label: 'Not connected' }

/**
 * Transport status of every linked wallet, by short wallet key: asked once, then
 * kept up to date by the changes the offscreen document sends (no polling). Empty
 * while unknown (e.g. the offscreen document does not answer yet).
 */
export const useWalletTransportStatus = () => {
  const [statuses, setStatuses] = useState<
    Record<string, WalletTransportStatus>
  >({})

  useEffect(() => {
    let active = true
    // A change that arrives first is newer than the answer.
    let changed = false
    const show = (links: LinkStatuses) => {
      if (!active) return
      setStatuses(
        Object.fromEntries(
          Object.entries(links).map(([walletKey, via]) => [
            walletKey,
            statusOfLink(via),
          ]),
        ),
      )
    }
    const onMessage = (
      message: Message,
      sender: chrome.runtime.MessageSender,
    ) => {
      if (message?.discriminator !== 'linkStatusesChanged') return
      if (!isExtensionPage(sender)) return
      changed = true
      show(message.statuses)
    }
    chrome.runtime.onMessage.addListener(onMessage)
    requestFromOffscreen(
      createMessage.getLinkStatuses(),
      config.diagnostics.requestTimeout,
    ).map(({ statuses: current }) => {
      if (!changed) show(current)
    })
    return () => {
      active = false
      chrome.runtime.onMessage.removeListener(onMessage)
    }
  }, [])

  return statuses
}
