import { generateMnemonic } from 'bip39'
import { Box, Button, Header, Text } from 'components'
import {
  LedgerSignTransactionResponse,
  createLedgerDeviceIdResponse,
  createLedgerOlympiaDeviceResponse,
  createLedgerPublicKeyResponse,
  createSignedResponse,
} from 'ledger/schemas'
import { useEffect, useState } from 'react'
import { BaseHdWallet, createRadixWallet } from '../hd-wallet/hd-wallet'
import { Curve } from '../hd-wallet/models'
import blake2b from 'blake2b'
import { logger } from 'utils/logger'
import { sendMessage } from 'chrome/messages/send-message'
import { createMessage } from 'chrome/messages/create-message'
import { compiledTxHex } from '../example'
import { curve25519 } from 'crypto/curve25519'
import { secp256k1 } from 'crypto/secp256k1'
import { blakeHashBase64 } from 'crypto/blake2b'

export const LedgerSimulator = () => {
  const [seed, setSeed] = useState<string>(
    'equip will roof matter pink blind book anxiety banner elbow sun young'
  )
  const [derivationPaths, setDerivationPaths] = useState<string[]>()
  const [interactionId, setInteractionId] = useState<string>(
    crypto.randomUUID()
  )
  const [device, setDevice] = useState<string>('00')
  const [curve, setCurve] = useState<keyof typeof Curve>('secp256k1')
  const [txIntent, setTxIntent] = useState<string>(
    compiledTxHex.createFungibleResourceWithInitialSupply
  )
  const [derivationPath, setDerivationPath] = useState<string>(
    `m/44'/1022'/10'/525'/1460'/0'`
  )

  useEffect(() => {
    const onMessage = (message: any) => {
      if (message?.discriminator !== 'walletToLedger') return

      if (message?.data?.interactionId) {
        setInteractionId(message.data.interactionId)
      }

      if (message?.data?.discriminator === 'importOlympiaDevice') {
        setDerivationPaths(
          message.data.derivationPaths.map((path: string) =>
            path.split('H').join(`'`)
          )
        )
      }
    }

    chrome.runtime.onMessage.addListener(onMessage)

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage)
    }
  }, [])

  const updateMnemonic = () => {
    setSeed(generateMnemonic())
  }

  const getDeviceId = (wallet: BaseHdWallet): string => {
    const publicKey = wallet.derivePath(`365'`).publicKey
    return blake2b(32).update(Buffer.from(publicKey, 'hex')).digest('hex')
  }

  const sendDeviceIdResponse = async () => {
    const wallet = createRadixWallet({ seed, curve: 'ed25519' })
    const response = createLedgerDeviceIdResponse(
      { interactionId, discriminator: 'getDeviceInfo' },
      getDeviceId(wallet),
      device
    )
    sendMessage(createMessage.ledgerResponse(response))
    setInteractionId(crypto.randomUUID())
  }

  const sendPublicKeyResponse = async () => {
    const wallet = createRadixWallet({ seed, curve })
    const response = createLedgerPublicKeyResponse(
      { interactionId, discriminator: 'derivePublicKeys' },
      [
        {
          derivationPath,
          curve: 'curve25519',
          publicKey: wallet.deriveFullPath(derivationPath).publicKey,
        },
      ]
    )
    sendMessage(createMessage.ledgerResponse(response))
    setInteractionId(crypto.randomUUID())
  }

  const renderDerivationPaths = () => {
    if (!derivationPaths) return null

    return (
      <Box flex="row" items="center">
        <Text bold css={{ minWidth: '200px' }}>
          Olympia Derivation Paths
        </Text>
        <Text>{derivationPaths?.join(', ')}</Text>
      </Box>
    )
  }

  const sendImportOlympiaDeviceResponse = async () => {
    const wallet = createRadixWallet({ seed, curve: 'secp256k1' })
    const id = getDeviceId(wallet)

    sendMessage(
      createMessage.ledgerResponse(
        createLedgerOlympiaDeviceResponse(
          { interactionId, discriminator: 'importOlympiaDevice' },
          {
            id,
            model: device,
            derivedPublicKeys:
              derivationPaths?.map((path) => ({
                path,
                publicKey: wallet.deriveFullPath(path).publicKey,
              })) || [],
          }
        )
      )
    )
  }

  const signTx = async () => {
    const wallet = createRadixWallet({ seed, curve })
    const { privateKey, publicKey } = wallet.deriveFullPath(derivationPath)
    const hash = blakeHashBase64(txIntent)

    logger.debug('TX intent blake hash', hash)

    if (curve === Curve.ed25519) {
      const pair = curve25519.keyFromSecret(privateKey)
      const signed = pair.sign(hash)
      const signature = signed.toHex()
      const response = createSignedResponse(
        { interactionId, discriminator: 'signTransaction' },
        [
          {
            signature,
            derivedPublicKey: {
              publicKey,
              curve: 'curve25519',
              derivationPath,
            },
          },
        ]
      )
      sendMessage(
        createMessage.ledgerResponse(response as LedgerSignTransactionResponse)
      )
      setInteractionId(crypto.randomUUID())
    } else {
      const pair = secp256k1.keyFromPrivate(privateKey)
      const signed = pair.sign(hash)
      const signature =
        signed.recoveryParam?.toString(16).padStart(2, '0') +
        signed.r.toString(16, 32) +
        signed.s.toString(16, 32)
      const response = createSignedResponse(
        { interactionId, discriminator: 'signTransaction' },
        [
          {
            signature,
            derivedPublicKey: { publicKey, curve: 'secp256k1', derivationPath },
          },
        ]
      )
      sendMessage(
        createMessage.ledgerResponse(response as LedgerSignTransactionResponse)
      )
      setInteractionId(crypto.randomUUID())
    }
  }

  return (
    <Box full p="medium">
      <Header dark>Ledger Simulator</Header>
      <Box flex="row" items="center">
        <Text bold css={{ minWidth: '140px' }}>
          Mnemonic / Seed
        </Text>
        <input
          className="w-100"
          value={seed}
          onChange={(ev) => setSeed(ev.target.value)}
        />
        <Button ml="small" onClick={updateMnemonic}>
          Regenerate
        </Button>
      </Box>
      <Box flex="row" items="center">
        <Text bold css={{ minWidth: '140px' }}>
          Interaction ID
        </Text>
        <input
          className="w-100"
          value={interactionId}
          onChange={(ev) => setInteractionId(ev.target.value)}
        />
        <Button
          ml="small"
          onClick={(ev) => setInteractionId(crypto.randomUUID())}
        >
          Regenerate
        </Button>
      </Box>
      {renderDerivationPaths()}
      <Box flex="row" items="center">
        <Text bold css={{ minWidth: '140px' }}>
          Derivation Path
        </Text>
        <Box>
          <input
            className="w-100"
            value={derivationPath}
            onChange={(ev) => setDerivationPath(ev.target.value)}
          />
          <Text
            muted
            size="small"
          >{`m/44'/<COIN_TYPE>'/<NETWORK_ID>'/<ENTITY_TYPE>'/<KEY_TYPE>'/<ENTITY_INDEX>'`}</Text>
        </Box>
      </Box>
      <Box flex="row" items="center">
        <Text bold css={{ minWidth: '140px' }}>
          Compiled TxIntent
        </Text>
        <Box flex="row">
          <textarea
            name="compiled_intent"
            cols={90}
            rows={7}
            value={txIntent}
            onInput={(ev) => {
              // @ts-ignore
              setTxIntent(ev.target.value || '')
            }}
          />
          <Box flex="col">
            {Object.keys(compiledTxHex).map((key) => (
              <Button
                key={key}
                onClick={() => {
                  setTxIntent(compiledTxHex[key])
                }}
              >
                {key}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>
      <Box flex="row">
        <Text bold css={{ minWidth: '160px' }}>
          Blake Intent Hash
        </Text>
        <Text>{blakeHashBase64(txIntent)}</Text>
      </Box>
      <Box flex="row">
        <Box>
          <Text bold>Ledger model</Text>
          <select onChange={(ev) => setDevice(ev.target.value)}>
            <option value="00">Nano S</option>
            <option value="01">Nano S Plus</option>
            <option value="02">Nano X</option>
          </select>
        </Box>
        <Box>
          <Text bold>Curve</Text>
          <select
            onChange={(ev) => setCurve(ev.target.value as keyof typeof Curve)}
          >
            <option value="secp256k1">secp256k1</option>
            <option value="ed25519">curve25519</option>
          </select>
        </Box>
      </Box>
      <Box>
        <Text bold>Actions</Text>
        <Button onClick={sendImportOlympiaDeviceResponse}>
          Send Olympia Import Response
        </Button>
        <Button onClick={sendDeviceIdResponse} ml="small">
          Send Device ID Response
        </Button>
        <Button onClick={sendPublicKeyResponse} ml="small">
          Send Public Key Response
        </Button>
        <Button onClick={signTx} ml="small">
          Sign Tx
        </Button>
      </Box>
    </Box>
  )
}
