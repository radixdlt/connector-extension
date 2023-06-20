import { compiledTxHex } from 'chrome/dev-tools/example'
import { LedgerWrapper, ledger } from './ledger-wrapper'
import TransportWebHID from '@ledgerhq/hw-transport-webhid'
import { LedgerInstructionCode } from './constants'
import { KeyParameters } from 'ledger/schemas'

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

const getExpectedTransactionSigningExchanges = ({
  instructionCode,
  p1,
  encodedDerivationPath,
  finalOutput,
}: {
  instructionCode: string
  finalOutput: string
  p1: string
  encodedDerivationPath: string
}) => [
  {
    input: 'aa120000',
    output: '305495ba9000',
  },
  {
    input: `aa${instructionCode}${p1}00${encodedDerivationPath}`,
    output: '9000',
  },
  {
    input: `ab${instructionCode}${p1}00ff4d21022109070107f20a00000000000000000ae8030000000000000a0500000000000000220101200720f381626e41e7027ea431bfe3009e94bdd25a746beec468948d6c3c7c5dc9a54b01000940420f00080300210220221416038000000000000000000000000000000000000000000000000000000a0c0a6669656c645f6e616d652200012200010c0176160380070dbcc2a13098e3ee62a091096d8feaf8dcd82540d4bda7d967c10c0a6669656c645f6e616d652200012200010c01761603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012200010c01761603800289ba4758731898e085`,
    output: '9000',
  },
  {
    input: `ab${instructionCode}${p1}00ff0fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d6522000122010101011603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220201077b1603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220301097b0000001603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012204010a7b000000000000001603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012205010485ffffff1603800289`,
    output: '9000',
  },
  {
    input: `ab${instructionCode}${p1}00ffba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012206010585ffffffffffffff1603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012207018500009a5d5e7eb7910000000000000000000000000000000000000000000000001603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d6522000122080180070dbcc2a13098e3ee62a091096d8feaf8dcd82540d4bda7d967c11603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d6522000122`,
    output: '9000',
  },
  {
    input: `ab${instructionCode}${p1}00ff09012200012007210000000000000000000000000000000000000000000000000000000000000000ff1603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220a01210280020868a5d95ac26285d644cdd0a4da49f87f31accccf7d0576749587000b736f6d655f737472696e671603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220b0187000b736f6d655f737472696e671603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220c01210105102700000000000016`,
    output: '9000',
  },
  {
    input: `ab${instructionCode}${p1}00ff03800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220d010c1468747470733a2f2f7261646978646c742e636f6d1603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d6522010120220300010c0b736f6d655f737472696e6700010c0e616e6f746865725f737472696e6700010c127965745f616e6f746865725f737472696e6717028000000000000000000000000000000000000000000000000000000a0c0a6669656c645f6e616d65170280070dbcc2a13098e3ee62a091096d8feaf8dcd82540d4bda7d967c10c0a6669656c645f6e616d`,
    output: '9000',
  },
  {
    input: `ac${instructionCode}${p1}002e651702800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65202000`,
    output: finalOutput,
  },
]

const ledgerDevice = {
  model: 'nanoS',
  id: '305495ba',
} as const

const keysParameters = [
  {
    derivationPath: `m/44'/1022'/10'/525'/0'/1238'`,
    curve: 'curve25519',
  },
] as KeyParameters[]

describe('Ledger Babylon Wrapper', () => {
  describe('when hardware device is not connected', () => {
    it('should fail to open transport layer', async () => {
      const result: any = await ledger.getDeviceInfo({} as any)

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
      const result: any = await ledger.getDeviceInfo({} as any)
      expect(result.isErr()).toBeTruthy()
      expect(result.error).toEqual('MultipleLedgerConnected')
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

      const result: any = await ledger.getDeviceInfo({} as any)

      expect(result.isErr()).toBeTruthy()
      expect(result.error).toBe('5515')
    })

    it('should return unknown error', async () => {
      const ledger = createLedgerWrapperWithMockedTransport([
        {
          input: 'aa120000',
          output: '7777',
        },
      ])

      const result: any = await ledger.getDeviceInfo({} as any)

      expect(result.isErr()).toBeTruthy()
      expect(result.error).toBe('7777')
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
      const result = await ledger.getDeviceInfo({} as any)
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

      const result = await ledger.getPublicKeys({
        interactionId: 'abc',
        discriminator: 'derivePublicKeys',
        ledgerDevice: {
          model: 'nanoS',
          id: 'aaaaaaaaaaa',
        },
        keysParameters,
      })
      expect(result.isErr()).toBeTruthy()
      if (result.isErr()) {
        expect(result.error).toBe('DeviceMismatch')
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

      const result = await ledger.getPublicKeys({
        interactionId: 'abc',
        discriminator: 'derivePublicKeys',
        ledgerDevice,
        keysParameters,
      })
      if (result.isErr()) throw result.error

      expect(result.value).toEqual([
        {
          curve: 'curve25519',
          derivationPath: `m/44'/1022'/10'/525'/0'/1238'`,
          publicKey: '111111111111',
        },
      ])
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

      const result = await ledger.getPublicKeys({
        ledgerDevice,
        interactionId: 'abc',
        discriminator: 'derivePublicKeys',
        keysParameters: [
          {
            derivationPath: `m/44'/1022'/10'/525'/0'/1238'`,
            curve: 'secp256k1',
          },
        ],
      })
      if (result.isErr()) throw result.error

      expect(result.value).toEqual([
        {
          curve: 'secp256k1',
          derivationPath: `m/44'/1022'/10'/525'/0'/1238'`,
          publicKey: '111111111111',
        },
      ])
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
          input: 'aa31000015058000002c800003fe800000000000000080000004',
          output: '44449000',
        },
        {
          input: 'aa31000015058000002c800003fe800000000000000080000002',
          output: '22229000',
        },
        {
          input: 'aa31000015058000002c800003fe800000000000000080000003',
          output: '33339000',
        },
      ])

      const result = await ledger.getOlympiaDeviceInfo({
        interactionId: 'abc',
        discriminator: 'importOlympiaDevice',
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
        interactionId: 'abc',
        discriminator: 'signTransaction',
        ledgerDevice: {
          model: 'nanoS',
          id: 'aaaaaaaaaaa',
        },
        signers: keysParameters,
        displayHash: false,
        compiledTransactionIntent: compiledTxHex.setMetadata,
        mode: 'verbose',
      })

      expect(result.isErr()).toBeTruthy()
      expect(result.error).toBe('DeviceMismatch')
    })

    it('should sign verbose TX using curve25519', async () => {
      const ledger = createLedgerWrapperWithMockedTransport(
        getExpectedTransactionSigningExchanges({
          p1: '00',
          instructionCode: LedgerInstructionCode.SignTxEd255519,
          encodedDerivationPath:
            '19068000002c800003fe8000000a8000020d800005b480000001',
          finalOutput:
            'b6d6f0ddd426dbce9af6dd6480c3e116823aa6ad05c97faef2c3b2ee678620d2e7f6a4887b54d9d7a0114fb1e8c359ed77c1d9db84d8acb0ffc518b90974ba01152fb698abd4a5aa588514bb217cbb20878c118588762bfbd3c3937d394a67915cb98b84f9fba860c2d91580c95b875736342050aa139be941927584908daf689000',
        })
      )

      const result = await ledger.signTransaction({
        ledgerDevice,
        interactionId: 'abc',
        discriminator: 'signTransaction',
        signers: [
          {
            curve: 'curve25519',
            derivationPath: 'm/44H/1022H/10H/525H/1460H/1H',
          },
        ],
        displayHash: false,
        compiledTransactionIntent: compiledTxHex.setMetadata,
        mode: 'verbose',
      })

      if (result.isErr()) throw result.error

      expect(result.value).toEqual([
        {
          derivedPublicKey: {
            curve: 'curve25519',
            derivationPath: `m/44H/1022H/10H/525H/1460H/1H`,
            publicKey:
              '152fb698abd4a5aa588514bb217cbb20878c118588762bfbd3c3937d394a6791',
          },
          signature:
            'b6d6f0ddd426dbce9af6dd6480c3e116823aa6ad05c97faef2c3b2ee678620d2e7f6a4887b54d9d7a0114fb1e8c359ed77c1d9db84d8acb0ffc518b90974ba01',
        },
      ])
    })

    it('should sign summary TX using secp256k1', async () => {
      const ledger = createLedgerWrapperWithMockedTransport(
        getExpectedTransactionSigningExchanges({
          instructionCode: LedgerInstructionCode.SignTxSecp256k1Smart,
          p1: '01',
          encodedDerivationPath: '15058000002c800003fe8000000a8000020d800004d6',
          finalOutput:
            '016c5f7dd77eb25825c814b11f2657b9ffd906dc9be187ff931c841cadb53570ef193a4c6041e615e5c547e171c309402be0e339882109ddd0479201272f52fcdb024483ba4e13195ed3b50b103c502a7799749261ae22a5b20950dd8815f65686455cb98b84f9fba860c2d91580c95b875736342050aa139be941927584908daf689000',
        })
      )

      const result = await ledger.signTransaction({
        interactionId: 'abc',
        discriminator: 'signTransaction',
        ledgerDevice,
        signers: [
          {
            derivationPath: `m/44H/1022H/10H/525H/1238H`,
            curve: 'secp256k1',
          },
        ],
        displayHash: true,
        compiledTransactionIntent: compiledTxHex.setMetadata,
        mode: 'summary',
      })

      if (result.isErr()) throw result.error

      expect(result.value).toEqual([
        {
          derivedPublicKey: {
            curve: 'secp256k1',
            derivationPath: `m/44H/1022H/10H/525H/1238H`,
            publicKey:
              '024483ba4e13195ed3b50b103c502a7799749261ae22a5b20950dd8815f6568645',
          },
          signature:
            '016c5f7dd77eb25825c814b11f2657b9ffd906dc9be187ff931c841cadb53570ef193a4c6041e615e5c547e171c309402be0e339882109ddd0479201272f52fcdb',
        },
      ])
    })
  })

  describe('auth signing', () => {
    it('should sign challange using different curves', async () => {
      const ledger = createLedgerWrapperWithMockedTransport([
        {
          input: 'aa120000',
          output: '305495ba9000',
        },
        {
          input: 'aa61000019068000002c800003fe8000000c8000020d800005b480000000',
          output: '9000',
        },
        {
          input:
            'ac6100007d17f3cb369f2632454f7f22c24e72b0adf7b95e36f2297467d3ff04010b2967e1416163636f756e745f7464785f625f317039646b6765643372707a79383630616d7074356a706d767633796c34793666357970707034746e736364736c767439763368747470733a2f2f64617368626f6172642e7264782e776f726b73',
          output:
            '5015423efc3ee29338df1877b7c9eaf563e894e89a327da9d5b5abbb7c2cda6ad36a66d6219d3817dba61737c0df398b7f5ae2df5b04a85c5f6985542684d80d451152a1cef7be603205086d4ebac0a0b78fda2ff4684b9dea5ca9ef003d4e7dc05cd851c0ff9d3d6022a23072640d4863b99c68d56ba1796dc0a75c32c46cef9000',
        },
        {
          input: 'aa71000015058000002c800003fe8000000c8000020d800004d6',
          output: '9000',
        },
        {
          input:
            'ac7100007d17f3cb369f2632454f7f22c24e72b0adf7b95e36f2297467d3ff04010b2967e1416163636f756e745f7464785f625f317039646b6765643372707a79383630616d7074356a706d767633796c34793666357970707034746e736364736c767439763368747470733a2f2f64617368626f6172642e7264782e776f726b73',
          output:
            '011c38168b1071585ccef652471beac0efcce58176c5ec24cd6e1af45058ec057e2990bdd899d24ea12c745c6c58819b86891998e2d7e1374eadca1ac2920ac187024483ba4e13195ed3b50b103c502a7799749261ae22a5b20950dd8815f6568645c05cd851c0ff9d3d6022a23072640d4863b99c68d56ba1796dc0a75c32c46cef9000',
        },
      ])

      const result = await ledger.signAuth({
        ledgerDevice,
        interactionId: 'abc',
        discriminator: 'signChallenge',
        signers: [
          {
            curve: 'curve25519',
            derivationPath: `m/44H/1022H/12H/525H/1460H/0H`,
          },
          {
            curve: 'secp256k1',
            derivationPath: `m/44H/1022H/12H/525H/1238H`,
          },
        ],
        challenge:
          '17f3cb369f2632454f7f22c24e72b0adf7b95e36f2297467d3ff04010b2967e1',
        origin: 'https://dashboard.rdx.works',
        dAppDefinitionAddress:
          'account_tdx_b_1p9dkged3rpzy860ampt5jpmvv3yl4y6f5yppp4tnscdslvt9v3',
      })
      if (result.isErr()) throw result.error

      expect(result.value).toEqual([
        {
          derivedPublicKey: {
            curve: 'curve25519',
            derivationPath: `m/44H/1022H/12H/525H/1460H/0H`,
            publicKey:
              '451152a1cef7be603205086d4ebac0a0b78fda2ff4684b9dea5ca9ef003d4e7d',
          },

          signature:
            '5015423efc3ee29338df1877b7c9eaf563e894e89a327da9d5b5abbb7c2cda6ad36a66d6219d3817dba61737c0df398b7f5ae2df5b04a85c5f6985542684d80d',
        },
        {
          derivedPublicKey: {
            curve: 'secp256k1',
            derivationPath: `m/44H/1022H/12H/525H/1238H`,
            publicKey:
              '024483ba4e13195ed3b50b103c502a7799749261ae22a5b20950dd8815f6568645',
          },
          signature:
            '011c38168b1071585ccef652471beac0efcce58176c5ec24cd6e1af45058ec057e2990bdd899d24ea12c745c6c58819b86891998e2d7e1374eadca1ac2920ac187',
        },
      ])
    })
  })
})
