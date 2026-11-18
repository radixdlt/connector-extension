import { useEffect, useState } from 'react'
import type { ResultAsync } from 'neverthrow'
import { config } from 'config'
import { createMessage } from 'chrome/messages/create-message'
import type { Message } from 'chrome/messages/_types'
import { requestFromOffscreen } from 'chrome/helpers/request-from-offscreen'
import { isExtensionPage } from 'chrome/messages/trusted-senders'
import type {
  PendingRequest,
  PendingRequestsResponse,
  RequestStatus,
  RequestOutcomes,
} from 'chrome/offscreen/requests/pending-request'

export const requestPendingRequests = (
  timeoutMs: number,
): ResultAsync<PendingRequestsResponse, Error> =>
  requestFromOffscreen(createMessage.getPendingRequests(), timeoutMs)

/**
 * Cancels a request that was not sent to the wallet yet. `cancelled: false`: it
 * could not be (e.g. the wallet already has it), with its status.
 */
export const cancelPendingRequest = (
  interactionId: string,
  timeoutMs: number,
): ResultAsync<{ cancelled: boolean; status?: RequestStatus }, Error> =>
  requestFromOffscreen(
    createMessage.cancelPendingRequest(interactionId),
    timeoutMs,
  )

/**
 * Sends again a request whose wallet disconnected without answering. `resent:
 * false`: it could not be (it is no longer in that state, or its link is gone).
 */
export const resendPendingRequest = (
  interactionId: string,
  timeoutMs: number,
): ResultAsync<{ resent: boolean }, Error> =>
  requestFromOffscreen(
    createMessage.resendPendingRequest(interactionId),
    timeoutMs,
  )

/**
 * The dApp requests of the offscreen document: fetched once, then kept up to date
 * by the changes it sends (no polling).
 */
/**
 * The offscreen document's requests, kept up to date, and how those just over ended
 * (for their cards to leave the right way).
 */
export const usePendingRequests = () => {
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [outcomes, setOutcomes] = useState<RequestOutcomes>({})

  useEffect(() => {
    let active = true
    // A change that arrives first is newer than the answer.
    let changed = false
    const onMessage = (
      message: Message,
      sender: chrome.runtime.MessageSender,
    ) => {
      if (message?.discriminator !== 'pendingRequestsChanged') return
      if (!isExtensionPage(sender)) return
      changed = true
      if (!active) return
      setOutcomes(message.outcomes ?? {})
      setRequests(message.requests)
    }
    chrome.runtime.onMessage.addListener(onMessage)
    requestPendingRequests(config.diagnostics.requestTimeout).map(
      ({ requests: current }) => {
        if (active && !changed) setRequests(current)
      },
    )
    return () => {
      active = false
      chrome.runtime.onMessage.removeListener(onMessage)
    }
  }, [])

  return { requests, outcomes }
}
