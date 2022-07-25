import { sha256 } from './sha256'

describe.only('sha256', () => {
  it('should hash input', async () => {
    const numArr = new Array(1000).fill(null).map((_, index) => index)
    for (const n of numArr) {
      const result = await sha256(n.toString())
      expect(result.isOk()).toBeTruthy()
    }
  })
})
