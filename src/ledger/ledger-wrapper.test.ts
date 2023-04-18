import { encodeHdPath } from './ledger-wrapper'

describe('Ledger Babylon Wrapper', () => {
  it('should encode hd path', () => {
    const testCases = [
      [
        `m/44'/1022'/10'/525'/0'/1238'`,
        '068000002c800003fe8000000a8000020d80000000800004d6',
      ],
      [
        `m/44H/1022H/10H/525H/0H/1238H`,
        '068000002c800003fe8000000a8000020d80000000800004d6',
      ],
      [
        `m/44'/1022'/10'/618'/1'/1211'`,
        '068000002c800003fe8000000a8000026a80000001800004bb',
      ],
    ]

    testCases.forEach(([input, expected]) => {
      expect(encodeHdPath(input)).toEqual(expected)
    })
  })
})
