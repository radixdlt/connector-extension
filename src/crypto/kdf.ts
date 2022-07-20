import { pbkdf2 } from 'crypto-browserify'
import { ResultAsync } from 'neverthrow'

const keyDerivation = (
  key: Buffer,
  options?: Partial<{
    salt: Buffer
    iterations: number
    keyLength: number
    digest: string
  }>
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    pbkdf2(
      key,
      options?.salt || Buffer.from([]),
      options?.iterations || 4096,
      options?.keyLength || 32,
      options?.digest || 'sha256',
      (err: Error, buffer: Buffer) => {
        if (err) {
          reject(err)
        }
        resolve(buffer)
      }
    )
  })

export const deriveKey = (key: Buffer) =>
  ResultAsync.fromPromise(keyDerivation(key), (e) => e as Error)
