import { sha256 } from './sha256'

describe('sha256', () => {
  it('should hash input', () => {
    new Array(1000).fill(null).forEach((_, index) => {
      expect(sha256(index.toString()).isOk()).toBeTruthy()
    })
  })
})
