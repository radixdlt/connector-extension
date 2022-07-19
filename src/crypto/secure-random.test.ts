import { secureRandom } from './secure-random'
describe('secure random byte generator', () => {
  it('should generate random bytes of various lengths', () => {
    new Array(1000).fill(null).forEach(() => {
      const expectedLength = Math.ceil(Math.random() * 100)
      const result = secureRandom(expectedLength)
      if (result.isOk()) {
        expect(result.value.length).toBe(expectedLength)
      } else {
        throw result.error
      }
    })
  })
  it('should fail to generate random bytes', () => {
    expect(secureRandom(-1)).toBeTruthy()
  })
})
