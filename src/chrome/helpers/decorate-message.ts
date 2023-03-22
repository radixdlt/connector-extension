import { ok, Result } from 'neverthrow'

export const decorateMessage = (
  message: Record<string, any>
): Result<Record<string, any>, never> => {
  const metadata = {
    ...(message.metadata || {}),
    origin: '{INVALID_ORIGIN}',
  }
  const decorated = { ...message, metadata }
  return ok(decorated)
}
