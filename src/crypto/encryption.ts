import { errAsync, ResultAsync } from 'neverthrow'
import { SealedBoxProps } from './sealbox'
import { secureRandom } from './secure-random'

export const createIV = () => secureRandom(12)

const getKey = (encryptionKey: string) =>
  ResultAsync.fromPromise(
    crypto.subtle.importKey(
      'raw',
      Buffer.from(encryptionKey, 'hex'),
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt']
    ),
    (error) => error as Error
  )

const cryptoDecrypt = (data: Buffer, encryptionKey: CryptoKey, iv: Buffer) =>
  ResultAsync.fromPromise(
    crypto.subtle.decrypt({ name: 'AES-GCM', iv }, encryptionKey, data),
    (error) => error as Error
  ).map(Buffer.from)

const cryptoEncrypt = (data: Buffer, encryptionKey: CryptoKey, iv: Buffer) =>
  ResultAsync.fromPromise(
    crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      encryptionKey,
      data
    ),
    (error) => error as Error
  ).map(Buffer.from)

export const decrypt = (
  data: Buffer,
  encryptionKey: string,
  iv: Buffer
): ResultAsync<Buffer, Error> => {
  if (!encryptionKey) {
    return errAsync(Error('MissingEncryptionKey'))
  } else if (!data) {
    return errAsync(Error('MissingEncryptedData'))
  }

  return getKey(encryptionKey).andThen((cryptoKey) =>
    cryptoDecrypt(data, cryptoKey, iv)
  )
}

const combineIVandCipherText = (iv: Buffer, ciphertext: Buffer): Buffer =>
  Buffer.concat([iv, ciphertext])

export const encrypt = (
  data: Buffer,
  encryptionKey: string,
  iv: Buffer
): ResultAsync<
  Omit<SealedBoxProps, 'ciphertextAndAuthTag' | 'authTag'>,
  Error
> =>
  getKey(encryptionKey)
    .andThen((cryptoKey) => cryptoEncrypt(data, cryptoKey, iv))
    .map((ciphertext) => ({
      combined: combineIVandCipherText(iv, ciphertext),
      iv,
      ciphertext,
    }))
