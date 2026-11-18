import type { ResultAsync } from 'neverthrow'
import { createMessage } from 'chrome/messages/create-message'
import type { ConnectionDiagnosticsResponse } from 'chrome/offscreen/wallet-connection/transport/diagnostics'
import { requestFromOffscreen } from 'chrome/helpers/request-from-offscreen'

/**
 * Asks the offscreen document, which holds the wallet connections, for their
 * diagnostics. Fails after `timeoutMs` (e.g. while the offscreen document is not
 * running), and never leaves a listener behind.
 */
export const requestConnectionDiagnostics = (
  timeoutMs: number,
): ResultAsync<ConnectionDiagnosticsResponse, Error> =>
  requestFromOffscreen(createMessage.getConnectionDiagnostics(), timeoutMs)
