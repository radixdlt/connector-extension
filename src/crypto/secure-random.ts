import { Buffer } from 'buffer'
import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'

export const secureRandom = (byteCount: number): Result<Buffer, Error> => {
  if (byteCount <= 0) {
    return err(new Error(`byteCount out of boundaries`))
  }

  const bytes = crypto.getRandomValues(new Uint8Array(byteCount))
  return ok(Buffer.from(bytes))
}
