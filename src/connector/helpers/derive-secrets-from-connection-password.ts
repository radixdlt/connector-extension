import { blake2b } from 'crypto/blake2b'

export const deriveSecretsFromPassword = (password: Buffer) =>
  blake2b(password).map((connectionId) => ({
    connectionId,
    encryptionKey: password,
  }))
