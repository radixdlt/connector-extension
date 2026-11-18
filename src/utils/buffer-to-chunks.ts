import chunk from 'lodash.chunk'
import type { Result } from 'neverthrow'
import { err, ok } from 'neverthrow'
import { errorIdentity } from './error-identity'
import { Buffer } from 'buffer'

export const bufferToChunks = (
  buffer: Buffer,
  chunkSize: number,
): Result<Buffer[], Error> => {
  try {
    return ok(
      chunk(buffer.toJSON().data, chunkSize).map((part) => Buffer.from(part)),
    )
  } catch (error) {
    return err(errorIdentity(error))
  }
}
