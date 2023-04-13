import { config } from 'config'
import { err, ok, Result } from 'neverthrow'
import { bufferToChunks } from 'utils'
import { Buffer } from 'buffer'
import { blake2b } from 'crypto/blake2b'
import { MessageChunk, MetaData } from 'connector/_types'

export const messageToChunked = (
  message: Buffer,
  chunkSize = config.webRTC.chunkSize
) => {
  const messageId = crypto.randomUUID()
  return bufferToChunks(message, chunkSize)
    .map((buffers) =>
      buffers.map(
        (buffer, chunkIndex): MessageChunk => ({
          packageType: 'chunk',
          chunkIndex,
          chunkData: buffer.toString('base64'),
          messageId,
        })
      )
    )
    .asyncAndThen((chunks) =>
      blake2b(message)
        .map(
          (buffer): MetaData => ({
            packageType: 'metaData',
            chunkCount: chunks.length,
            messageByteCount: message.byteLength,
            hashOfMessage: buffer.toString('hex'),
            messageId,
          })
        )
        .map((metaData) => ({ metaData, chunks }))
    )
}

export const Chunked = (metaData: MetaData) => {
  const chunks: MessageChunk[] = []

  const addChunk = (chunk: MessageChunk) => {
    if (chunk.messageId !== metaData.messageId)
      return err(Error('messageId mismatch'))

    if (chunks.length === metaData.chunkCount)
      return err(Error('expected chunks received'))

    chunks.push(chunk)
    return ok(undefined)
  }

  const concatChunks = (): Result<string, Error> => {
    try {
      return ok(
        chunks
          .map(({ chunkData }) =>
            Buffer.from(chunkData, 'base64').toString('utf-8')
          )
          .join('')
      )
    } catch (error) {
      return err(Error('failed to decode chunked messages'))
    }
  }

  const allChunksReceived = (): Result<boolean, never> =>
    metaData ? ok(metaData.chunkCount === chunks.length) : ok(false)

  const validate = () =>
    concatChunks()
      .asyncAndThen((value) => blake2b(Buffer.from(value, 'utf-8')))
      .andThen((hash) => {
        const expectedHash = hash.toString('hex')
        return expectedHash === metaData.hashOfMessage
          ? ok(undefined)
          : err(
              Error(
                `message hash "${metaData.hashOfMessage}" does not match expected hash "${expectedHash}"`
              )
            )
      })

  const getMessage = () =>
    allChunksReceived().asyncAndThen(validate).andThen(concatChunks)

  return {
    addChunk,
    allChunksReceived,
    validate,
    metaData,
    toString: getMessage,
  }
}
