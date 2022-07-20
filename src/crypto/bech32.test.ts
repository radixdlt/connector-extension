import { bech32Encode, convertBufferToBech32 } from './bech32'

describe('bech32', () => {
  it('should convert buffer to bech32', () => {
    new Array(10000).fill(null).forEach(() => {
      const randomNumber = Math.ceil(Math.random() * 50)
      const buffer = Buffer.from(
        crypto.getRandomValues(new Uint8Array(randomNumber))
      )

      const result = convertBufferToBech32(buffer).andThen(bech32Encode)

      if (result.isOk()) {
        expect(result.isOk()).toBeTruthy()
      } else {
        throw result.error
      }
    })
  })
})
