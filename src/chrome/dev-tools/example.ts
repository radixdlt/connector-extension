import { LedgerDeriveAndDisplayAddressRequest } from './../../ledger/schemas'
import {
  KeyParameters,
  LedgerDeviceIdRequest,
  LedgerPublicKeyRequest,
  LedgerSignChallengeRequest,
  LedgerSignTransactionRequest,
} from 'ledger/schemas'

export const compiledTxHex: Record<string, string> = {
  multipleTransfer:
    '4d220104210707210aff1b0000000000000a091c00000000000009279bffff22010120072008ae52e030b35f05cae71778dcfdda83ef99327edce7a632c5dd4d54e93de7db010008000020220641038051e9c732a7cd25e747471fad2de06e8b8884dded5c2027f293adec0f03ae0c086c6f636b5f6665652101850000e8890423c78a00000000000000000000000000000000000000000000000041038051e9c732a7cd25e747471fad2de06e8b8884dded5c2027f293adec0f03ae0c0877697468647261772102805da66318c6318c61f5a61b4c6318c6318cf794aa8d295f14e6318c6318c685000020c65abc8ed70a00000000000000000000000000000000000000000000000002805da66318c6318c61f5a61b4c6318c6318cf794aa8d295f14e6318c6318c685000010632d5ec76b05000000000000000000000000000000000000000000000041038051bc35642340244b4dac4c988cec9d8e057736fa2d57f923d8c3994896280c147472795f6465706f7369745f6f725f61626f7274210181000000000002805da66318c6318c61f5a61b4c6318c6318cf794aa8d295f14e6318c6318c685000010632d5ec76b05000000000000000000000000000000000000000000000041038051200b2dbb1e02406c4e5e560aeec40b9bd50765826f4f29eb05d87ff5c20c147472795f6465706f7369745f6f725f61626f7274210181010000002020002100',
  setMetadata:
    '4d21022109070107f20a00000000000000000ae8030000000000000a0500000000000000220101200720f381626e41e7027ea431bfe3009e94bdd25a746beec468948d6c3c7c5dc9a54b01000940420f00080300210220221416038000000000000000000000000000000000000000000000000000000a0c0a6669656c645f6e616d652200012200010c0176160380070dbcc2a13098e3ee62a091096d8feaf8dcd82540d4bda7d967c10c0a6669656c645f6e616d652200012200010c01761603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012200010c01761603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d6522000122010101011603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220201077b1603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220301097b0000001603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012204010a7b000000000000001603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012205010485ffffff1603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012206010585ffffffffffffff1603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012207018500009a5d5e7eb7910000000000000000000000000000000000000000000000001603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d6522000122080180070dbcc2a13098e3ee62a091096d8feaf8dcd82540d4bda7d967c11603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d652200012209012200012007210000000000000000000000000000000000000000000000000000000000000000ff1603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220a01210280020868a5d95ac26285d644cdd0a4da49f87f31accccf7d0576749587000b736f6d655f737472696e671603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220b0187000b736f6d655f737472696e671603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220c0121010510270000000000001603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65220001220d010c1468747470733a2f2f7261646978646c742e636f6d1603800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d6522010120220300010c0b736f6d655f737472696e6700010c0e616e6f746865725f737472696e6700010c127965745f616e6f746865725f737472696e6717028000000000000000000000000000000000000000000000000000000a0c0a6669656c645f6e616d65170280070dbcc2a13098e3ee62a091096d8feaf8dcd82540d4bda7d967c10c0a6669656c645f6e616d651702800289ba4758731898e0850fbde5d412c080e4f8b7ea03174cb180d90c0a6669656c645f6e616d65202000',
  createAccount:
    '4d21022109070107f20a00000000000000000ae8030000000000000a0500000000000000220101200720f381626e41e7027ea431bfe3009e94bdd25a746beec468948d6c3c7c5dc9a54b01000940420f0008030021022022022104800000000000000000000000000000000000000000000000000000050c074163636f756e740c0f6372656174655f616476616e6365642101210623212200230c220022000122010023212200230c22002200012201002104800000000000000000000000000000000000000000000000000000050c074163636f756e740c066372656174652100202000',
}

export const getDeviceInfoPayload = (): LedgerDeviceIdRequest => ({
  interactionId: crypto.randomUUID(),
  discriminator: 'getDeviceInfo',
})

export const getDeriveAndDisplayPayload =
  (): LedgerDeriveAndDisplayAddressRequest => ({
    interactionId: crypto.randomUUID(),
    discriminator: 'deriveAndDisplayAddress',
    keyParameters: {
      curve: 'curve25519',
      derivationPath: 'm/44H/1022H/10H/525H/1460H/0H',
    },
    ledgerDevice: {
      name: 'My Ledger Device',
      model: 'nanoS',
      id: '02c66e1c1ee74b57d0e944d34f97cc07e6ddf08c70b9e71cf373fd1c191be85c',
    },
  })

export const getDerivePublicKeyPayload = (): LedgerPublicKeyRequest => ({
  interactionId: crypto.randomUUID(),
  discriminator: 'derivePublicKeys',
  keysParameters: [
    {
      curve: 'curve25519',
      derivationPath: 'm/44H/1022H/10H/525H/1460H/0H',
    },
  ],
  ledgerDevice: {
    name: 'My Ledger Device',
    model: 'nanoS',
    id: '02c66e1c1ee74b57d0e944d34f97cc07e6ddf08c70b9e71cf373fd1c191be85c',
  },
})

const getSignChallengePayload = (
  signers: KeyParameters[],
): LedgerSignChallengeRequest => ({
  interactionId: crypto.randomUUID(),
  discriminator: 'signChallenge',
  signers,
  ledgerDevice: {
    name: 'My Ledger Device',
    model: 'nanoS',
    id: '41ac202687326a4fc6cb677e9fd92d08b91ce46c669950d58790d4d5e583adc0',
  },
  challenge: '17f3cb369f2632454f7f22c24e72b0adf7b95e36f2297467d3ff04010b2967e1',
  origin: 'https://dashboard.rdx.works',
  dAppDefinitionAddress:
    'account_tdx_b_1p9dkged3rpzy860ampt5jpmvv3yl4y6f5yppp4tnscdslvt9v3',
})

const getSignTxPayload = (
  signers: KeyParameters[],
  compiledTransactionIntent: string,
): LedgerSignTransactionRequest => ({
  interactionId: crypto.randomUUID(),
  discriminator: 'signTransaction',
  signers,
  ledgerDevice: {
    name: 'My Ledger Device',
    model: 'nanoS',
    id: '41ac202687326a4fc6cb677e9fd92d08b91ce46c669950d58790d4d5e583adc0',
  },
  displayHash: true,
  compiledTransactionIntent,
})

export const getSignEd25519TransactionPayload =
  (): LedgerSignTransactionRequest =>
    getSignTxPayload(
      [
        {
          curve: 'curve25519',
          derivationPath: 'm/44H/1022H/10H/525H/1460H/0H',
        },
        {
          curve: 'curve25519',
          derivationPath: 'm/44H/1022H/10H/525H/1460H/1H',
        },
      ],
      compiledTxHex.multipleTransfer,
    )

export const getSignSecp256k1TransactionPayload =
  (): LedgerSignTransactionRequest =>
    getSignTxPayload(
      [
        {
          curve: 'secp256k1',
          derivationPath: 'm/44H/1022H/10H/525H/1238H',
        },
      ],
      compiledTxHex.multipleTransfer,
    )

export const getSignEd222519ChallengePayload = () =>
  getSignChallengePayload([
    {
      curve: 'curve25519',
      derivationPath: 'm/44H/1022H/12H/525H/1460H/0H',
    },
  ])

export const getSignSecp256k1ChallengePayload = () =>
  getSignChallengePayload([
    {
      curve: 'secp256k1',
      derivationPath: 'm/44H/1022H/10H/525H/1238H',
    },
  ])

  export const getRejectAccountListRequestPayload = () => {
    return {
      interactionId: '',
      discriminator: 'accountListRejectedResponse',
    }
  }

  export const getAccountListResponsePayload = () => {
    return {
      interactionId: '',
      discriminator: 'accountListResponse',
      accounts: [
        {
          label: 'Account 1',
          address:
            'account_rdx12y4l35lh2543nff9pyyzvsh64ssu0dv6fq20gg8suslwmjvkylejgj',
          appearanceId: 0,
        },
      ],
    }
  }