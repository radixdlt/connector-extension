import { Buffer } from 'buffer'
import blake2bHash from 'blake2b'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

export const blake2b = (input: Buffer): ResultAsync<Buffer, Error> => {
  const output = new Uint8Array(32)
  try {
    return okAsync(
      blake2bHash(output.length).update(new Uint8Array(input)).digest('hex'),
    ).map((hex) => Buffer.from(hex, 'hex'))
  } catch (error) {
    return errAsync(error as Error)
  }
}

export const blakeHashHexSync = (data: string) =>
  blakeHashBufferToHex(Buffer.from(data, 'hex'))

export const blakeHashBufferToHex = (buffer: Buffer) =>
  blake2bHash(32).update(new Uint8Array(buffer)).digest('hex')
