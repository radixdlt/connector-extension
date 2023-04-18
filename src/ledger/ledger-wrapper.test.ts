import { compiledTxHex } from 'chrome/dev-tools/example'
import {
  LedgerInstructionCode,
  LedgerWrapper,
  encodeHdPath,
  ledger,
} from './ledger-wrapper'
import TransportWebHID from '@ledgerhq/hw-transport-webhid'

const createLedgerWrapperWithMockedTransport = (
  expectedExchanges: {
    input: string
    output: string
  }[],
  devices: HIDDevice[] = []
): ReturnType<typeof LedgerWrapper> => {
  let exchangeIndex = 0

  return LedgerWrapper({
    transport: {
      list: () => Promise.resolve(devices),
      create: () =>
        Promise.resolve({
          exchange: (buffer: Buffer) => {
            expect(buffer.toString('hex')).toBe(
              expectedExchanges[exchangeIndex].input
            )
            return Promise.resolve(
              Buffer.from(expectedExchanges[exchangeIndex++].output, 'hex')
            )
          },
          close: () => Promise.resolve(),
        }),
    } as unknown as typeof TransportWebHID,
  })
}

const getExpectedTransactionSigningExchanges = (instructionCode: string) => [
  {
    input: 'aa120000',
    output: '305495ba9000',
  },
  {
    input: `aa${instructionCode}000019068000002c800003fe8000000a8000020d80000000800004d6`,
    output: '9000',
  },
  {
    input: `ab${instructionCode}0000ff4d21022109070107f20a00000000000000000ae8030000000000000a0500000000000000220101200720f381626e41e7027ea431bfe3009e94bdd25a746beec468948d6c3c7c5dc9a54b01000940420f00080300210220221416038000000000000000000000000000000000000000000000000000000a0c0a6669656c645f6e616d652200012200010c0176160380070dbcc2a13098e3ee62a091096d8feaf8dcd82540d4bda7d967c10c0a6669656c645f6e616d652200012200010c01761603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012200010c01761603800289ba4758731898e085`,
    output: '9000',
  },
  {
    input: `ab${instructionCode}0000ff0fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d6522000122010101011603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220201077b1603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220301097b0000001603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012204010a7b000000000000001603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012205010485ffffff1603800289`,
    output: '9000',
  },
  {
    input: `ab${instructionCode}0000ffba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012206010585ffffffffffffff1603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012207018500009a5d5e7eb7910000000000000000000000000000000000000000000000001603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d6522000122080180070dbcc2a13098e3ee62a091096d8feaf8dcd82540d4bda7d967c11603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d6522000122`,
    output: '9000',
  },
  {
    input: `ab${instructionCode}0000ff09012200012007210000000000000000000000000000000000000000000000000000000000000000ff1603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220a01210280020868a5d95ac26285d644cdd0a4da49f87f31accccf7d0576749587000b736f6d655f737472696e671603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220b0187000b736f6d655f737472696e671603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220c01210105102700000000000016`,
    output: '9000',
  },
  {
    input: `ab${instructionCode}0000ff03800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220d010c1468747470733a2f2f7261646978646c742e636f6d1603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d6522010120220300010c0b736f6d655f737472696e6700010c0e616e6f746865725f737472696e6700010c127965745f616e6f746865725f737472696e6717028000000000000000000000000000000000000000000000000000000a0c0a6669656c645f6e616d65170280070dbcc2a13098e3ee62a091096d8feaf8dcd82540d4bda7d967c10c0a6669656c645f6e616d`,
    output: '9000',
  },
  {
    input: `ac${instructionCode}00002e651702800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65202000`,
    output: 'abababab9000',
  },
]

const ledgerDevice = {
  model: 'nanoS',
  id: '305495ba',
} as const

const keyParameters = {
  derivationPath: `m/44'/1022'/10'/525'/0'/1238'`,
  curve: 'curve25519',
} as const

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

  describe('when hardware device is not connected', () => {
    it('should fail to open transport layer', async () => {
      const result: any = await ledger.getDeviceInfo()

      expect(result.isErr()).toBeTruthy()
      expect(result.error).toEqual('FailedToCreateTransport')
    })
  })

  describe('when two hardware devices are connected', () => {
    it('should fail to open transport layer', async () => {
      const device: HIDDevice = {} as any
      const ledger = createLedgerWrapperWithMockedTransport(
        [],
        [device, device]
      )
      const result: any = await ledger.getDeviceInfo()
      expect(result.isErr()).toBeTruthy()
      expect(result.error).toEqual('Please connect only one ledger device')
    })
  })

  describe('when data is being exchanged and ledger responds with error', () => {
    it('should map known error to string', async () => {
      const ledger = createLedgerWrapperWithMockedTransport([
        {
          input: 'aa120000',
          output: '5515',
        },
      ])

      const result: any = await ledger.getDeviceInfo()

      expect(result.isErr()).toBeTruthy()
      expect(result.error).toBe('Please unlock Ledger Device and try again')
    })

    it('should return unknown error', async () => {
      const ledger = createLedgerWrapperWithMockedTransport([
        {
          input: 'aa120000',
          output: '7777',
        },
      ])

      const result: any = await ledger.getDeviceInfo()

      expect(result.isErr()).toBeTruthy()
      expect(result.error).toBe('Unknown error: 7777')
    })
  })

  describe('getting device info', () => {
    it('should get device id and model as string', async () => {
      const ledger = createLedgerWrapperWithMockedTransport([
        {
          input: 'aa120000',
          output: '305495ba0fdfd3c400568ce7a2ff9000',
        },
        {
          input: 'aa110000',
          output: '009000',
        },
      ])
      const result = await ledger.getDeviceInfo()
      if (result.isErr()) throw result.error

      expect(result.value).toEqual({
        deviceId: '305495ba0fdfd3c400568ce7a2ff',
        model: '00',
      })
    })
  })

  describe('getting public key', () => {
    it('should match device id before getting public key', async () => {
      const ledger = createLedgerWrapperWithMockedTransport([
        {
          input: 'aa120000',
          output: '305495ba9000',
        },
      ])

      const result = await ledger.getPublicKey({
        ledgerDevice: {
          model: 'nanoS',
          id: 'aaaaaaaaaaa',
        },
        keyParameters,
      })
      expect(result.isErr()).toBeTruthy()
      if (result.isErr()) {
        expect(result.error).toBe(
          "Device doesn't match. Make sure you connected correct Ledger device"
        )
      }
    })

    it('should get public key with curve25519', async () => {
      const ledger = createLedgerWrapperWithMockedTransport([
        {
          input: 'aa120000',
          output: '305495ba9000',
        },
        {
          input: 'aa21000019068000002c800003fe8000000a8000020d80000000800004d6',
          output: '1111111111119000',
        },
      ])

      const result = await ledger.getPublicKey({
        ledgerDevice,
        keyParameters,
      })
      if (result.isErr()) throw result.error

      expect(result.value).toEqual('111111111111')
    })

    it('should get public key with secp256k1', async () => {
      const ledger = createLedgerWrapperWithMockedTransport([
        {
          input: 'aa120000',
          output: '305495ba9000',
        },
        {
          input: 'aa31000019068000002c800003fe8000000a8000020d80000000800004d6',
          output: '1111111111119000',
        },
      ])

      const result = await ledger.getPublicKey({
        ledgerDevice,
        keyParameters: {
          derivationPath: `m/44'/1022'/10'/525'/0'/1238'`,
          curve: 'secp256k1',
        },
      })
      if (result.isErr()) throw result.error

      expect(result.value).toEqual('111111111111')
    })
  })

  describe('importing olympia ledger device', () => {
    it('should get secp256k1 public key for each derivation path', async () => {
      const ledger = createLedgerWrapperWithMockedTransport([
        {
          input: 'aa120000',
          output: '305495ba9000',
        },
        {
          input: 'aa110000',
          output: '019000',
        },
        {
          input: 'aa31000015058000002c800003fe800000008000000080000004',
          output: '44449000',
        },
        {
          input: 'aa31000015058000002c800003fe800000008000000080000002',
          output: '22229000',
        },
        {
          input: 'aa31000015058000002c800003fe800000008000000080000003',
          output: '33339000',
        },
      ])

      const result = await ledger.getOlympiaDeviceInfo({
        derivationPaths: [
          'm/44H/1022H/0H/0/4H',
          'm/44H/1022H/0H/0/2H',
          'm/44H/1022H/0H/0/3H',
        ],
      })

      if (result.isErr()) throw result.error

      expect(result.value).toEqual({
        id: '305495ba',
        model: '01',
        derivedPublicKeys: [
          {
            path: 'm/44H/1022H/0H/0/4H',
            publicKey: '4444',
          },
          {
            path: 'm/44H/1022H/0H/0/2H',
            publicKey: '2222',
          },
          {
            path: 'm/44H/1022H/0H/0/3H',
            publicKey: '3333',
          },
        ],
      })
    })
  })

  describe('transaction signing', () => {
    it('should match device id before signing transaction', async () => {
      const ledger = createLedgerWrapperWithMockedTransport([
        {
          input: 'aa120000',
          output: '305495ba9000',
        },
      ])

      const result: any = await ledger.signTransaction({
        ledgerDevice: {
          model: 'nanoS',
          id: 'aaaaaaaaaaa',
        },
        keyParameters,
        compiledTransactionIntent: compiledTxHex.setMetadata,
        mode: 'verbose',
      })

      expect(result.isErr()).toBeTruthy()
      expect(result.error).toBe(
        "Device doesn't match. Make sure you connected correct Ledger device"
      )
    })

    it('should sign verbose TX using curve25519', async () => {
      const ledger = createLedgerWrapperWithMockedTransport(
        getExpectedTransactionSigningExchanges(
          LedgerInstructionCode.SignTxEd255519
        )
      )

      const result = await ledger.signTransaction({
        ledgerDevice,
        keyParameters,
        compiledTransactionIntent: compiledTxHex.setMetadata,
        mode: 'verbose',
      })

      if (result.isErr()) throw result.error

      expect(result.value).toEqual('abababab')
    })

    it('should sign summary TX using secp256k1', async () => {
      const ledger = createLedgerWrapperWithMockedTransport(
        getExpectedTransactionSigningExchanges(
          LedgerInstructionCode.SignTxSecp256k1Smart
        )
      )

      const result = await ledger.signTransaction({
        ledgerDevice,
        keyParameters: {
          derivationPath: `m/44'/1022'/10'/525'/0'/1238'`,
          curve: 'secp256k1',
        },
        compiledTransactionIntent: compiledTxHex.setMetadata,
        mode: 'summary',
      })

      if (result.isErr()) throw result.error

      expect(result.value).toEqual('abababab')
    })
  })
})
