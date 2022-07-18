import { ok, err, Result } from 'neverthrow'

export const chunksToBuffer = (chunks: Buffer[]): Result<Buffer, Error> => {
  try {
    return ok(Buffer.concat(chunks))
  } catch (error) {
    return err(error as Error)
  }
}
