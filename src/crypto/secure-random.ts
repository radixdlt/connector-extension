import { Buffer } from 'buffer'
import { err, ok, Result } from 'neverthrow'

export const secureRandom = (byteCount: number): Result<Buffer, Error> => {
  if (byteCount <= 0) {
    return err(new Error(`byteCount out of boundaries`))
  }

  const bytes = crypto.getRandomValues(new Uint8Array(byteCount))
  return ok(Buffer.from(bytes))
}
