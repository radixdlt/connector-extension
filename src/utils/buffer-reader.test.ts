import { readBuffer } from './buffer-reader'

const getArr = (length: number) => new Array(length).fill(null)
describe('buffer reader', () => {
  const uuid = crypto.randomUUID()
  const buffer = Buffer.from(uuid)
  const data = buffer.toJSON().data
  it('should correctly read buffer', () => {
    const reader = readBuffer(buffer)

    getArr(5).forEach((_, index) => {
      const result = reader(7)
      if (result.isErr()) throw result.error
      expect(result.value.toJSON().data).toEqual(
        data.slice(index * 7, index * 7 + 7),
      )
    })
  })

  describe('unhappy paths', () => {
    it('should return error if over byte count', () => {
      const reader = readBuffer(buffer)

      // eslint-disable-next-line max-nested-callbacks
      getArr(6).forEach(() => {
        const result = reader(7)
        if (result.isErr()) {
          expect(result.error).toEqual(Error(`Out of buffer's boundary`))
        }
      })
    })
    it('should return error if byte count is negative number', () => {
      const reader = readBuffer(buffer)

      const result = reader(-1)
      if (result.isErr()) {
        expect(result.error).toEqual(Error(`'byteCount' must not be negative`))
      }
    })
  })
})
