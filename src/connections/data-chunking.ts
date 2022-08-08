import { config } from 'config'
import { sha256 } from 'crypto/sha256'
import log from 'loglevel'
import { err, ok, Result } from 'neverthrow'
import { bufferToChunks } from 'utils'

type MetaData = {
  packageType: 'metaData'
  chunkCount: number
  hashOfMessage: string
  messageId: string
}

type MessageChunk = {
  packageType: 'chunk'
  chunkIndex: number
  chunkData: string
  messageId: string
}

type MessageError = 'messageHashesMismatch'

type ChunkedMessageReceiveMessageError = {
  packageType: 'receiveMessageError'
  messageId: string
  error: MessageError
}

type MessageErrorTypes = ChunkedMessageReceiveMessageError

export type ChunkedMessageType = MetaData | MessageChunk | MessageErrorTypes

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
      sha256(message)
        .map(
          (buffer): MetaData => ({
            packageType: 'metaData',
            chunkCount: chunks.length,
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
    log.debug(`🍞 incoming chunk: ${chunks.length}/${metaData.chunkCount}`)
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
      log.error(error)
      return err(Error('failed to decode chunked messages'))
    }
  }

  const allChunksReceived = (): Result<boolean, never> =>
    metaData ? ok(metaData.chunkCount === chunks.length) : ok(false)

  const validate = () =>
    concatChunks()
      .asyncAndThen(sha256)
      .andThen((sha256Hash) =>
        sha256Hash.toString('hex') === metaData.hashOfMessage
          ? ok(undefined)
          : err(Error('chunked message hash does not match expected hash'))
      )

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
