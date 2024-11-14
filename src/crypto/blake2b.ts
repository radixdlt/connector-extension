import { Buffer } from 'buffer'
import blake from 'blakejs'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

export const blake2b = (input: Buffer): ResultAsync<Buffer, Error> => {
  const output = new Uint8Array(32)
  try {
    return okAsync(
      blake.blake2b(new Uint8Array(input), undefined, output.length),
    ).map((hex) => Buffer.from(hex))
  } catch (error) {
    return errAsync(error as Error)
  }
}

export const blakeHashHexSync = (data: string) =>
  blakeHashBufferToHex(Buffer.from(data, 'hex'))

export const blakeHashBufferToHex = (buffer: Buffer) =>
  Buffer.from(blake.blake2b(new Uint8Array(buffer), undefined, 32)).toString(
    'hex',
  )
