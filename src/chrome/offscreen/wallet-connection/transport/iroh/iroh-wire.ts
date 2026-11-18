import { err, ok, type Result } from 'neverthrow'
import { errorIdentity } from 'utils/error-identity'
import { parseJSON } from 'utils/parse-json'
import {
  messageErrorReasons,
  type MessageErrorReason,
  type SendMessageError,
  type TransportMessage,
} from '../wallet-transport'
import { getIrohErrorCode, type IrohErrorCode } from './iroh-bindings'

// What crosses the iroh connection: messages as JSON text, and the session's
// errors as the transports' send errors.

const sendErrorReasons: Record<IrohErrorCode, MessageErrorReason> = {
  // Nothing was sent: the caller may retry, or use another transport.
  notConnected: messageErrorReasons.notConnected,
  closed: messageErrorReasons.notConnected,
  messageTooLarge: messageErrorReasons.failedToPrepareMessage,
  // The wallet may have received the message.
  timeout: messageErrorReasons.timeout,
  rejected: messageErrorReasons.failedToSendMessage,
  connectionLost: messageErrorReasons.failedToSendMessage,
  internal: messageErrorReasons.failedToSendMessage,
  invalidPassword: messageErrorReasons.failedToSendMessage,
  invalidRelayUrl: messageErrorReasons.failedToSendMessage,
  bind: messageErrorReasons.failedToSendMessage,
}

export const toSendMessageError = (error: unknown): SendMessageError => {
  const code = getIrohErrorCode(error)
  return {
    reason: code
      ? sendErrorReasons[code]
      : messageErrorReasons.failedToSendMessage,
    jsError: errorIdentity(error),
  }
}

const isJsonObject = (value: unknown): value is TransportMessage =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A message as the JSON text the session sends. */
export const serialize = (
  message: TransportMessage,
): Result<string, SendMessageError> => {
  try {
    const json = JSON.stringify(message)
    return typeof json === 'string'
      ? ok(json)
      : err({ reason: messageErrorReasons.failedToPrepareMessage })
  } catch (error) {
    return err({
      reason: messageErrorReasons.failedToPrepareMessage,
      jsError: errorIdentity(error),
    })
  }
}

/** Why a text from the wallet is not a message. */
export type IncomingProblem = 'not valid JSON' | 'not a JSON object'

/** A text from the wallet as a message: a JSON object. */
export const parseIncoming = (
  raw: string,
): Result<TransportMessage, IncomingProblem> => {
  const parsed = parseJSON<unknown>(raw)
  if (parsed.isErr()) return err('not valid JSON')
  return isJsonObject(parsed.value)
    ? ok(parsed.value)
    : err('not a JSON object')
}
