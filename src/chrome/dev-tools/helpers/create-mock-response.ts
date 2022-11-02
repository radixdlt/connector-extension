import { Buffer } from 'buffer'
import { KeyPair } from './keypair'

const mockRequestPayloads = {
  accountAddresses: {
    addresses: [
      {
        label: 'Main account',
        address:
          'account_tdx_a_1qv3jfqugkm70ely0trae20wcwealxmj5zsacnhkllhgqlccnrp',
      },
      {
        label: "NFT's",
        address:
          'account_tdx_a_1qd5svul20u30qnq408zhj2tw5evqrunq48eg0jsjf9qsx5t8qu',
      },
      {
        label: 'Savings',
        address:
          'account_tdx_a_1qwz8dwm79jpq8fagt9vx0mug22ckznh3g45mfv4lmq2sjlwzqj',
      },
    ],
  },
  personaData: {
    fields: [
      { field: 'firstName', value: 'alex' },
      {
        field: 'email',
        value: 'alex@rdx.works',
      },
    ],
  },
} as any

const getMockRequestTypePayload = async (
  item: any,
  message: Record<string, any>
) => {
  if (item.requestType === 'login') {
    const loginPayload = await handleLogin(item, message)
    return { ...item, ...loginPayload }
  }

  const mockData = mockRequestPayloads[item.requestType]

  if (!mockData) throw new Error('unsupported request type')

  return { ...item, ...mockData }
}

const getWellKnown = async (origin: string) => {
  const result = await fetch(`${origin}/.well-known/radix.json`, {
    headers: { 'Content-type': 'application/json' },
  })
  return result.json()
}

const handleLogin = async (
  item: Record<string, any>,
  message: Record<string, any>
) => {
  const dAppId = item.dAppId
  const wellKnown = await getWellKnown(message.metadata.origin)
  const expectedDApp = wellKnown.dApps.find((dApp: any) => dApp.id === dAppId)

  if (!expectedDApp) throw new Error('missing expectedDApp')

  const challenge: string = item.challenge
  const dAppDefinitionAddress = expectedDApp.definitionAddress
  const origin = message.metadata.origin

  const messageToSignBuffer = Buffer.concat([
    Buffer.from(challenge, 'hex'),
    Buffer.from(dAppDefinitionAddress),
    Buffer.from(origin),
  ])

  const keyPair = await KeyPair()

  const signatureBuffer = await keyPair.sign(messageToSignBuffer)

  console.log(messageToSignBuffer.toString('hex'))

  return {
    challenge,
    signature: signatureBuffer.toString('hex'),
    publicKey: keyPair.publicKeyHex,
    identityComponentAddress:
      'account_tdx_a_1qv3jfqugkm70ely0trae20wcwealxmj5zsacnhkllhgqlccnrp',
    origin,
  }
}

export const createMockResponse = async (message: any) => {
  let response: any = { ...message }

  switch (message.method) {
    case 'request':
      response.payload = []

      for (const item of message.payload) {
        response.payload.push(await getMockRequestTypePayload(item, message))
      }
      break

    case 'sendTransaction':
      response.payload = { transactionIntentHash: crypto.randomUUID() }
      break

    default:
      throw new Error('unsupported method')
  }

  return response
}
