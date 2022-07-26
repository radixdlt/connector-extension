import { encrypt, decrypt } from './encryption'
const testMessage = 'Hello RDX JavaScript from Swift'
const testMessage2 = 'Hello RDX Swift from TS'

const combinedHex =
  'beefbeefbeefbeefbeefbeef2f8525856c67b0bbf31ecc5a51bdbb501b875bda57d1713ce16f33544c8a88e6cfcefa8ea661e3eedc3daa814532c5'

const encryptionKey =
  'feedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed'

const encryptionKey2 =
  'faedfaedfaedfaedfaedfaedfaedfaedfaedfaedfaedfaedfaedfaedfaedfaed'

describe('Encryption', () => {
  it('should encrypt and decrypt correctly', async () => {
    const iv = Buffer.from('beefbeefbeefbeefbeefbeef', 'hex')
    const encrypted = await encrypt(
      Buffer.from(testMessage, 'utf8'),
      Buffer.from(encryptionKey, 'hex'),
      iv
    )

    if (encrypted.isErr()) throw encrypted.error

    expect(encrypted.value.combined.toString('hex')).toBe(combinedHex)

    const decrypted = await decrypt(
      encrypted.value.ciphertext,
      Buffer.from(encryptionKey, 'hex'),
      encrypted.value.iv
    )

    if (decrypted.isErr()) throw decrypted.error
    expect(decrypted.value.toString('utf8')).toBe(testMessage)
  })

  it('should decrypt with error', async () => {
    const decrypted = await decrypt(
      Buffer.from(testMessage, 'hex'),
      Buffer.from(encryptionKey, 'hex'),
      Buffer.from('test')
    )
    expect(decrypted.isErr()).toBe(true)
  })

  it('should encrypt and decrypt correctly (second message)', async () => {
    const iv = Buffer.from('feebfeebfeebfeebfeebfeeb', 'hex')
    const encrypted = await encrypt(
      Buffer.from(testMessage2, 'utf8'),
      Buffer.from(encryptionKey2, 'hex'),
      iv
    )

    if (encrypted.isErr()) throw encrypted.error
    const decrypted = await decrypt(
      encrypted.value.ciphertext,
      Buffer.from(encryptionKey2, 'hex'),
      encrypted.value.iv
    )

    if (decrypted.isErr()) throw decrypted.error
    expect(decrypted.value.toString('utf8')).toBe(testMessage2)
  })
})
