import { convertBufferToBech32 } from './bech32'

describe('bech32', () => {
  it('should convert buffer to bech32', () => {
    new Array(10000).fill(null).forEach(() => {
      const randomNumber = Math.ceil(Math.random() * 100)
      const buffer = Buffer.from(
        crypto.getRandomValues(new Uint8Array(randomNumber))
      )
      expect(convertBufferToBech32(buffer).isOk()).toBeTruthy()
    })
  })
})
