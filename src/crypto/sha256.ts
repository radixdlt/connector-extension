import { ResultAsync } from 'neverthrow'
import { errorIdentity } from 'utils/error-identity'

const toBuffer = (input: Buffer | string): Buffer =>
  typeof input === 'string' ? Buffer.from(input, 'utf-8') : input

export const sha256 = (input: Buffer | string) =>
  ResultAsync.fromPromise(
    crypto.subtle.digest('SHA-256', toBuffer(input)),
    errorIdentity
  ).map(Buffer.from)
