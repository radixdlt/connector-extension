import { generateMnemonic } from 'bip39'
import { Box, Button, Header, Text } from 'components'
import {
  createLedgerDeviceIdResponse,
  createLedgerPublicKeyResponse,
  createLedgerSignedTransactionResponse,
} from 'ledger/schemas'
import { useState } from 'react'
import { createRadixWallet } from '../hd-wallet/hd-wallet'
import { Curve } from '../hd-wallet/models'
import { ec as Elliptic } from 'elliptic'
import blake2b from 'blake2b'
import { logger } from 'utils/logger'
import { sendMessage } from 'chrome/messages/send-message'
import { createMessage } from 'chrome/messages/create-message'
import { compiledTxHex } from '../example'

const secp256k1 = new Elliptic('secp256k1')
const ed25519 = new Elliptic('ed25519')

const buf2hex = (buffer: any) =>
  [...new Uint8Array(buffer)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')

export const LedgerSimulator = () => {
  const [seed, setSeed] = useState<string>(
    'equip will roof matter pink blind book anxiety banner elbow sun young'
  )
  const [interactionId, setInteractionId] = useState<string>(
    crypto.randomUUID()
  )
  const [device, setDevice] = useState<string>('0')
  const [curve, setCurve] = useState<keyof typeof Curve>('secp256k1')
  const [txIntent, setTxIntent] = useState<string>(
    compiledTxHex.createFungibleResourceWithInitialSupply
  )
  const [hdPath, setHdPath] = useState<string>(`m/44'/1022'/10'/525'/0'/1238'`)
  const updateMnemonic = () => {
    setSeed(generateMnemonic())
  }

  const sendDeviceIdResponse = async () => {
    const wallet = createRadixWallet({ seed, curve: 'ed25519' })
    const publicKey = wallet.derivePath(`365'`).publicKey.slice(2)
    const hashed = await crypto.subtle.digest(
      'SHA-256',
      Buffer.from(publicKey, 'hex')
    )
    const hashed2 = await crypto.subtle.digest('SHA-256', hashed)
    const response = createLedgerDeviceIdResponse(
      { interactionId, discriminator: 'getDeviceInfo' },
      buf2hex(hashed2),
      device
    )
    sendMessage(createMessage.ledgerResponse(response))
    setInteractionId(crypto.randomUUID())
  }

  const sendPublicKeyResponse = async () => {
    const wallet = createRadixWallet({ seed, curve })
    const publicKey = wallet.deriveFullPath(hdPath).publicKey
    const response = createLedgerPublicKeyResponse(
      { interactionId, discriminator: 'derivePublicKey' },
      curve === 'ed25519' ? publicKey.slice(2) : publicKey
    )
    sendMessage(createMessage.ledgerResponse(response))
    setInteractionId(crypto.randomUUID())
  }

  const signTx = async () => {
    const wallet = createRadixWallet({ seed, curve })
    const privateKey = wallet.deriveFullPath(hdPath).privateKey
    const publicKey = wallet.deriveFullPath(hdPath).publicKey
    const output = new Uint8Array(64)
    const hash = blake2b(output.length)
      .update(Buffer.from(txIntent, 'base64'))
      .digest('hex')

    logger.debug('TX intent blake hash', hash)

    if (curve === Curve.ed25519) {
      const pair = ed25519.keyFromPrivate(privateKey)
      const signed = pair.sign(hash)
      const signedTx = signed.r.toString(16, 32) + signed.s.toString(16, 32)
      const response = createLedgerSignedTransactionResponse(
        { interactionId, discriminator: 'signTransaction' },
        signedTx,
        publicKey
      )
      sendMessage(createMessage.ledgerResponse(response))
      setInteractionId(crypto.randomUUID())
    } else {
      const pair = secp256k1.keyFromPrivate(privateKey)
      const signed = pair.sign(hash)
      const signedTx =
        signed.recoveryParam?.toString(16).padStart(2, '0') +
        signed.r.toString(16, 32) +
        signed.s.toString(16, 32)
      const response = createLedgerSignedTransactionResponse(
        { interactionId, discriminator: 'signTransaction' },
        signedTx,
        publicKey
      )
      sendMessage(createMessage.ledgerResponse(response))
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
      <Box flex="row" items="center">
        <Text bold css={{ minWidth: '140px' }}>
          Derivation Path
        </Text>
        <Box>
          <input
            className="w-100"
            value={hdPath}
            onChange={(ev) => setHdPath(ev.target.value)}
          />
          <Text
            muted
            size="small"
          >{`m/44'/<COIN_TYPE>'/<NETWORK_ID>'/<ENTITY_TYPE>'/<ENTITY_INDEX>'/<KEY_TYPE>'`}</Text>
        </Box>
      </Box>
      <Box flex="row" items="center">
        <Text bold css={{ minWidth: '140px' }}>
          Compiled TxIntent
        </Text>
        <Box flex="row">
          <textarea
            name="compiled_intent"
            cols={70}
            rows={12}
            value={txIntent}
            onInput={(ev) => {
              // @ts-ignore
              setTxIntent(ev.target.value || '')
            }}
          />
          <Box flex="col">
            {Object.keys(compiledTxHex).map((key) => (
              <Button key={key} onClick={() => setTxIntent(compiledTxHex[key])}>
                {key}
              </Button>
            ))}
          </Box>
        </Box>
      </Box>
      <Box flex="row">
        <Box>
          <Text bold>Ledger model</Text>
          <select onChange={(ev) => setDevice(ev.target.value)}>
            <option value="0">Nano S</option>
            <option value="1">Nano S Plus</option>
            <option value="2">Nano X</option>
          </select>
        </Box>
        <Box>
          <Text bold>Curve</Text>
          <select
            onChange={(ev) => setCurve(ev.target.value as keyof typeof Curve)}
          >
            <option value="secp256k1">secp256k1</option>
            <option value="curve25519">curve25519</option>
          </select>
        </Box>
      </Box>
      <Box>
        <Text bold>Actions</Text>
        <Button onClick={sendDeviceIdResponse}>Send Device ID Response</Button>
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
