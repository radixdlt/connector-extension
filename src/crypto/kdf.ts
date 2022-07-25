import { ResultAsync } from 'neverthrow'

export const getKeyMaterial = (key: Buffer) =>
  ResultAsync.fromPromise(
    crypto.subtle.importKey('raw', key, 'PBKDF2', false, [
      'deriveBits',
      'deriveKey',
    ]),
    (error) => error as Error
  )

const getKey = (
  keyMaterial: CryptoKey,
  {
    salt,
    iterations,
    digest,
  }: {
    salt: Buffer
    iterations: number
    digest: string
  }
) =>
  ResultAsync.fromPromise(
    crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations,
        hash: digest,
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    ),
    (error) => error as Error
  )

const exportKey = (cryptoKey: CryptoKey) =>
  ResultAsync.fromPromise(
    crypto.subtle.exportKey('raw', cryptoKey),
    (error) => error as Error
  )

export const deriveKey = (
  key: Buffer,
  options?: Partial<{
    salt: Buffer
    iterations: number
    digest: string
  }>
) =>
  getKeyMaterial(key).andThen((keyMaterial) =>
    getKey(keyMaterial, {
      ...{
        salt: Buffer.from([]),
        iterations: 4096,
        digest: 'SHA-256',
      },
      ...(options || {}),
    })
      .andThen(exportKey)
      .map(Buffer.from)
  )
