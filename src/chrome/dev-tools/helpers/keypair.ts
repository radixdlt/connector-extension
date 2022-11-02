import { Buffer } from 'buffer'

export const KeyPair = async () => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify']
  )

  const publicKeyHex = Buffer.from(
    await crypto.subtle.exportKey('raw', keyPair.publicKey)
  ).toString('hex')

  const sign = async (messageBuffer: Buffer) =>
    Buffer.from(
      await crypto.subtle.sign(
        {
          name: 'ECDSA',
          hash: { name: 'SHA-256' },
        },
        keyPair.privateKey,
        messageBuffer
      )
    )

  return { sign, publicKeyHex }
}
