import { Buffer } from 'buffer'
import blake2bHash from 'blake2b'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

export const blake2b = (input: Buffer): ResultAsync<Buffer, Error> => {
  const output = new Uint8Array(32)
  try {
    return okAsync(
      blake2bHash(output.length).update(new Uint8Array(input)).digest('hex')
    ).map((hex) => Buffer.from(hex, 'hex'))
  } catch (error) {
    return errAsync(error as Error)
  }
}

export const blakeHashBase64 = (data: string) =>
  blake2bHash(32)
    .update(new Uint8Array(Buffer.from(data, 'base64')))
    .digest('hex')
