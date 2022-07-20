import { ok, Result } from 'neverthrow'
import { bech32 } from 'bech32'

export const convertBufferToBech32 = (
  buffer: Buffer
): Result<Buffer, Error> => {
  const bech32Data = bech32.toWords(buffer)
  return ok(Buffer.from(bech32Data))
}
