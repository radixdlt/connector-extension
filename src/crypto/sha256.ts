import { ResultAsync } from 'neverthrow'
import { errorIdentity } from 'utils/error-identity'
import { toBuffer } from 'utils/to-buffer'

export const sha256 = (input: Buffer | string) =>
  ResultAsync.fromPromise(
    crypto.subtle.digest('SHA-256', toBuffer(input)),
    errorIdentity
  ).map(Buffer.from)
