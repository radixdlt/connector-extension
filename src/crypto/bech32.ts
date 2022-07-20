import { err, Ok, ok, Result } from 'neverthrow'
import { bech32 } from 'bech32'

export const convertBufferToBech32 = (buffer: Buffer): Ok<Buffer, never> => {
  const bech32Data = bech32.toWords(buffer)
  return ok(Buffer.from(bech32Data))
}

export const bech32Encode = (buffer: Buffer): Result<string, Error> => {
  if (buffer.length > 90) {
    return err(new Error('Buffer exceeds length limit'))
  }
  const bech32String = bech32
    .encode('', buffer)
    // drop bech32 delimiter/separator and checksum
    .slice(1, -6)
  return ok(bech32String)
}
