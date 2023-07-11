import { transformBufferToSealbox } from './sealbox'

const sealboxHex =
  'beefbeefbeefbeefbeefbeef2f8525856c67b0bbf31ecc5a51bdbb501b875bda57d1713ce16f33544c8a88e6cfcefa8ea661e3eedc3daa814532c5'
const sealboxBuffer = Buffer.from(sealboxHex, 'hex')

describe('Sealbox', () => {
  it('should transform buffer to sealbox (iv + ciphertext) and back again to sealbox', async () => {
    const sealbox = transformBufferToSealbox(sealboxBuffer)
    if (sealbox.isErr()) throw sealbox.error

    const { iv, ciphertext, authTag, combined } = sealbox.value
    expect(iv.toString('hex')).toEqual('beefbeefbeefbeefbeefbeef')
    expect(authTag.toString('hex')).toEqual('e6cfcefa8ea661e3eedc3daa814532c5')
    expect(ciphertext.toString('hex')).toEqual(
      '2f8525856c67b0bbf31ecc5a51bdbb501b875bda57d1713ce16f33544c8a88',
    )

    expect(combined.toString('hex')).toEqual(sealboxHex)
  })
})
