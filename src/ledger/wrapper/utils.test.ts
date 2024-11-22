import { getDataLength } from './utils'
import { describe, it, expect } from 'vitest'

describe('utils', () => {
  describe('getDataLength', () => {
    it('should return two characters', () => {
      expect(getDataLength('')).toEqual('00')
      expect(getDataLength('6f7274210181010000002020002100')).toEqual('0f')
      expect(
        getDataLength(
          '6f72742101810100000020200021006f7274210181010000002020002100',
        ),
      ).toEqual('1e')
      expect(getDataLength('1111')).toEqual('02')
      expect(getDataLength('12345678901234567890')).toEqual('0a')
    })
  })
})
