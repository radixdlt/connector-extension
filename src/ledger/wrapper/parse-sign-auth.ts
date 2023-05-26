import { blakeHashHexSync } from 'crypto/blake2b'
import { LedgerSignChallengeRequest } from 'ledger/schemas'
import { getDataLength } from './utils'

export const parseSignAuth = (
  params: Omit<LedgerSignChallengeRequest, 'discriminator' | 'interactionId'>
) => {
  const addressLength = params.dAppDefinitionAddress.length.toString(16)
  const encodedDappAddress = Buffer.from(
    params.dAppDefinitionAddress,
    'utf-8'
  ).toString('hex')
  const encodedOrigin = Buffer.from(params.origin, 'utf-8').toString('hex')
  const data =
    params.challenge + addressLength + encodedDappAddress + encodedOrigin
  const dataLength = getDataLength(data)
  return {
    challengeData: `${dataLength}${data}`,
    hashToSign: blakeHashHexSync(
      `${params.challenge}${addressLength}${encodedDappAddress}${encodedOrigin}`
    ),
  }
}
