import { err, ok, Result } from 'neverthrow'

export const secureRandom = (byteCount: number): Result<Buffer, Error> => {
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(byteCount))
    return ok(Buffer.from(bytes))
  } catch (error) {
    return err(error as Error)
  }
}
