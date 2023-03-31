import { sha256 } from 'crypto/sha256'

export const deriveSecretsFromPassword = (password: Buffer) =>
  sha256(password).map((connectionId) => ({
    connectionId,
    encryptionKey: password,
  }))
