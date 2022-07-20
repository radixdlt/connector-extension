import { deriveKey } from './kdf'

describe('key derivation function', () => {
  it('should succeed to derive key', async () => {
    const result = await deriveKey(Buffer.from('123', 'utf8'))

    if (result.isErr()) {
      throw result.error
    }

    expect(result._unsafeUnwrap().toString('hex')).toBe(
      '45d423c89fccaca134e37e5ae4887c1cf2eb7e1b4a7117f2a6aaf17d8d16c312'
    )
  })
})
