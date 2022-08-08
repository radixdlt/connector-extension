import chunk from 'lodash.chunk'
import { err, ok, Result } from 'neverthrow'
import { errorIdentity } from './error-identity'

export const bufferToChunks = (
  buffer: Buffer,
  chunkSize: number
): Result<Buffer[], Error> => {
  try {
    return ok(
      chunk(buffer.toJSON().data, chunkSize).map((part) => Buffer.from(part))
    )
  } catch (error) {
    return err(errorIdentity(error))
  }
}
