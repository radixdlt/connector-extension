import { blake2b, blakeHashHexSync } from './blake2b'
import { Buffer } from 'buffer'

describe('blake2b', () => {
  it('should hash a string', async () => {
    const result = await blake2b(Buffer.from('test'))

    if (result.isErr()) throw result.error

    expect(result.value.toString('hex')).toBe(
      '928b20366943e2afd11ebc0eae2e53a93bf177a4fcf35bcc64d503704e65e202',
    )
  })

  it('should hash base64 string synchronously', () => {
    const hash = blakeHashHexSync('74657374')
    expect(hash).toBe(
      '928b20366943e2afd11ebc0eae2e53a93bf177a4fcf35bcc64d503704e65e202',
    )
  })
})
