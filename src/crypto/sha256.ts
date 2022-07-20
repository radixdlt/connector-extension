import { sha256 as SHA256 } from 'hash.js'
import { Ok, ok } from 'neverthrow'

const toBuffer = (input: Buffer | string): Buffer =>
  typeof input === 'string' ? Buffer.from(input, 'utf-8') : input

export const sha256 = (input: Buffer | string): Ok<Buffer, never> =>
  ok(Buffer.from(SHA256().update(toBuffer(input)).digest()))
