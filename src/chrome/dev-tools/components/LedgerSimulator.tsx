import { generateMnemonic } from 'bip39'
import { Box, Button, Header, Text } from 'components'
import {
  KeyParameters,
  LedgerDeviceIdRequest,
  LedgerPublicKeyRequest,
  LedgerRequest,
  LedgerRequestSchema,
  LedgerResponse,
  LedgerSignChallengeRequest,
  LedgerSignTransactionRequest,
  createLedgerSuccessResponse,
  isDeviceIdRequest,
  isPublicKeyRequest,
  isSignChallengeRequest,
  isSignTransactionRequest,
} from 'ledger/schemas'
import { useEffect, useState } from 'react'
import { BaseHdWallet, createRadixWallet } from '../hd-wallet/hd-wallet'
import { sendMessage } from 'chrome/messages/send-message'
import { createMessage } from 'chrome/messages/create-message'
import { curve25519 } from 'crypto/curve25519'
import { secp256k1 } from 'crypto/secp256k1'
import { blakeHashHexSync } from 'crypto/blake2b'
import { parseSignAuth } from 'ledger/wrapper/parse-sign-auth'
import { ec, eddsa } from 'elliptic'
import { logger } from 'utils/logger'

const DEFAULT_MNEMONIC =
  'equip will roof matter pink blind book anxiety banner elbow sun young'

const generateWallets = (seed: string) => ({
  seed,
  curve25519: createRadixWallet({
    seed,
    curve: 'ed25519',
  }),
  secp256k1: createRadixWallet({
    seed,
    curve: 'secp256k1',
  }),
})

const signingConfig = {
  curve25519: {
    createKeyPair: (privateKey: string) => curve25519.keyFromSecret(privateKey),
    signatureToHex: (signed: eddsa.Signature) => signed.toHex(),
  },
  secp256k1: {
    createKeyPair: (privateKey: string) => secp256k1.keyFromPrivate(privateKey),
    signatureToHex: (signed: ec.Signature) =>
      signed.recoveryParam?.toString(16).padStart(2, '0') +
      signed.r.toString(16, 32) +
      signed.s.toString(16, 32),
  },
}

const getLocalStorageMnemonics = () => {
  try {
    const mnemonics =
      JSON.parse(localStorage.getItem('radix-dev-tools-mnemonics') ?? '[]') ||
      []
    return mnemonics
  } catch (e) {
    return []
  }
}

const addLocalStorageMnemonic = (name: string, mnemonic: string) => {
  const mnemonics = [...getLocalStorageMnemonics(), { name, mnemonic }]
  localStorage.setItem('radix-dev-tools-mnemonics', JSON.stringify(mnemonics))
}

const mapSignerToSignature = (
  signer: KeyParameters,
  hashToSign: string,
  wallet: BaseHdWallet,
) => {
  const curveConfig = signingConfig[signer.curve]
  const { privateKey, publicKey } = wallet.deriveFullPath(signer.derivationPath)
  const keyPair = curveConfig.createKeyPair(privateKey)
  const signed = keyPair.sign(hashToSign)
  const signature = curveConfig.signatureToHex(signed as any)
  return {
    signature,
    derivedPublicKey: {
      publicKey,
      curve: signer.curve,
      derivationPath: signer.derivationPath,
    },
  }
}

export const LedgerSimulator = () => {
  const [rememberedMnemonics, setRememberedMnemonics] = useState<
    { mnemonic: string; name: string }[]
  >(getLocalStorageMnemonics())
  const [device, setDevice] = useState<'nanoS' | 'nanoS+' | 'nanoX'>('nanoS')
  const [wallet, setWallet] = useState(generateWallets(DEFAULT_MNEMONIC))
  const [walletRequest, setWalletRequest] = useState<LedgerRequest>()
  const [messageId, setMessageId] = useState<string>()

  useEffect(() => {
    const onMessage = (message: any) => {
      if (message?.discriminator !== 'walletToLedger') return
      try {
        LedgerRequestSchema.parse(message.data)
        const walletRequest = message.data as LedgerRequest
        setWalletRequest(walletRequest)
        setMessageId(message.messageId)
      } catch (e) {
        logger.error('Ledger request failed validation')
      }
    }

    chrome.runtime.onMessage.addListener(onMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage)
    }
  }, [])

  const updateMnemonic = () => {
    setWallet(generateWallets(generateMnemonic()))
  }

  const rememberMnemonic = () => {
    const mnemonicName = prompt('Please provide name for remembered mnemonic')
    addLocalStorageMnemonic(mnemonicName ?? '--not provided--', wallet.seed)
    setRememberedMnemonics(getLocalStorageMnemonics())
  }

  const mockRespond = async () => {
    const createResponse = () => {
      if (isDeviceIdRequest(walletRequest)) {
        return getDeviceIdResponse(walletRequest)
      } else if (isPublicKeyRequest(walletRequest)) {
        return getPublicKeyResponse(walletRequest)
      } else if (isSignChallengeRequest(walletRequest)) {
        return getSignAuthChallengeResponse(walletRequest)
      } else if (isSignTransactionRequest(walletRequest)) {
        return getSignTransactionResponse(walletRequest)
      }
    }
    const response = await createResponse()
    if (response) {
      sendMessage(createMessage.ledgerResponse(response as LedgerResponse))
      sendMessage(createMessage.confirmationSuccess('any', messageId!))
      sendMessage(createMessage.closeLedgerTab())
      setMessageId(undefined)
      setWalletRequest(undefined)
    }
  }

  const getDeviceIdResponse = async (request: LedgerDeviceIdRequest) =>
    createLedgerSuccessResponse(request, {
      id: blakeHashHexSync(wallet.curve25519.derivePath(`365'`).publicKey),
      model: device,
    })

  const getPublicKeyResponse = async (request: LedgerPublicKeyRequest) => {
    if (request?.keysParameters?.length) {
      return createLedgerSuccessResponse(
        request,
        request.keysParameters.map((keyParameters) => ({
          ...keyParameters,
          publicKey:
            keyParameters.curve === 'curve25519'
              ? wallet.curve25519.deriveFullPath(keyParameters.derivationPath)
                  .publicKey
              : wallet.secp256k1.deriveFullPath(keyParameters.derivationPath)
                  .publicKey,
        })),
      )
    }
  }

  const renderKeysParameters = () => {
    const keysParameters: KeyParameters[] =
      (walletRequest as any)?.keysParameters ||
      (walletRequest as any)?.signers ||
      []

    if (!keysParameters.length) return null
    return (
      <Box flex="row" items="center">
        <Text bold css={{ minWidth: '200px' }}>
          Key Params / Signers
        </Text>
        <ul>
          {keysParameters.map((param, index) => (
            <li key={index}>{`${param.curve} - ${param.derivationPath}`}</li>
          ))}
        </ul>
      </Box>
    )
  }

  const renderBlakeTxIntentHash = () => {
    const intent = (walletRequest as LedgerSignTransactionRequest)
      ?.compiledTransactionIntent
    if (!intent) return null
    const hash = intent ? blakeHashHexSync(intent) : ''

    return (
      <Box flex="row">
        <Text bold css={{ minWidth: '160px' }}>
          Intent Hash
        </Text>
        <Text>{hash}</Text>
      </Box>
    )
  }

  const renderAuthChallenge = () => {
    if (walletRequest?.discriminator === 'signChallenge') {
      return (
        <>
          <Box flex="row">
            <Text bold css={{ minWidth: '160px' }}>
              dApp
            </Text>
            <Text>{walletRequest.dAppDefinitionAddress}</Text>
          </Box>
          <Box flex="row">
            <Text bold css={{ minWidth: '160px' }}>
              Origin
            </Text>
            <Text>{walletRequest.origin}</Text>
          </Box>
          <Box flex="row">
            <Text bold css={{ minWidth: '160px' }}>
              Nonce
            </Text>
            <Text>{walletRequest.challenge}</Text>
          </Box>
          <Box flex="row">
            <Text bold css={{ minWidth: '160px' }}>
              Auth Hash
            </Text>
            <Text>{parseSignAuth(walletRequest).hashToSign}</Text>
          </Box>
        </>
      )
    }

    return null
  }

  const getSignAuthChallengeResponse = async (
    request: LedgerSignChallengeRequest,
  ) => {
    const { hashToSign } = parseSignAuth(request)
    return createLedgerSuccessResponse(
      request,
      request.signers.map((signer) =>
        mapSignerToSignature(signer, hashToSign, wallet[signer.curve]),
      ),
    )
  }

  const getSignTransactionResponse = async (
    request: LedgerSignTransactionRequest,
  ) => {
    const hashToSign = blakeHashHexSync(request.compiledTransactionIntent)

    return createLedgerSuccessResponse(
      request,
      request.signers.map((signer) =>
        mapSignerToSignature(signer, hashToSign, wallet[signer.curve]),
      ),
    )
  }

  const renderWalletRequest = () => (
    <>
      <Box flex="row" items="center">
        <Text bold css={{ minWidth: '140px' }}>
          Interaction ID
        </Text>
        <Text>{walletRequest?.interactionId}</Text>
      </Box>
      <Box flex="row" items="center">
        <Text bold css={{ minWidth: '140px' }}>
          Discriminator
        </Text>
        <Text>{walletRequest?.discriminator}</Text>
      </Box>
      {renderKeysParameters()}
      {renderBlakeTxIntentHash()}
      {renderAuthChallenge()}
      <Button full onClick={mockRespond}>
        Mock Respond
      </Button>
    </>
  )

  const renderRememberedMnemonics = () => {
    if (rememberedMnemonics.length === 0) return null

    return (
      <Box flex="row" items="center">
        <Text bold css={{ minWidth: '140px' }}>
          Remembered
        </Text>
        <select
          defaultValue={DEFAULT_MNEMONIC}
          onChange={(ev) => {
            try {
              setWallet(generateWallets(ev.target.value))
            } catch (e) {
              logger.error('Invalid seed phrase')
            }
          }}
        >
          <option value={DEFAULT_MNEMONIC}>
            Default Mnemonic - {DEFAULT_MNEMONIC}
          </option>
          {rememberedMnemonics.map(({ mnemonic, name }, index) => (
            <option value={mnemonic} key={index}>
              {name} - {mnemonic}
            </option>
          ))}
        </select>
      </Box>
    )
  }

  return (
    <Box bg="white" p="medium" rounded style={{ minWidth: '450px' }}>
      <Header dark>Ledger Simulator</Header>
      {renderRememberedMnemonics()}
      <Box flex="row" items="center">
        <Text bold css={{ minWidth: '140px' }}>
          Ledger Device
        </Text>
        <select
          defaultValue="nanoS"
          onChange={(ev) =>
            setDevice(ev.target.value as 'nanoS' | 'nanoS+' | 'nanoX')
          }
        >
          <option value="nanoS">Nano S</option>
          <option value="nanoS+">Nano S Plus</option>
          <option value="nanoX">Nano X</option>
        </select>
      </Box>
      <Box flex="row" items="center">
        <Text bold css={{ minWidth: '140px' }}>
          Mnemonic
        </Text>
        <input
          className="w-100"
          value={wallet.seed}
          onChange={(ev) => {
            try {
              setWallet(generateWallets(ev.target.value))
            } catch (e) {
              logger.error('Invalid seed phrase')
            }
          }}
        />
      </Box>
      <Box flex="row">
        <Button ml="sm" onClick={updateMnemonic}>
          Regenerate
        </Button>
        <Button ml="sm" onClick={rememberMnemonic}>
          Remember
        </Button>
      </Box>

      {walletRequest ? renderWalletRequest() : 'Waiting for wallet request...'}
    </Box>
  )
}
