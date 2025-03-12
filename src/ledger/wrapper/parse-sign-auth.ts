import { blakeHashHexSync } from 'crypto/blake2b'
import { LedgerSignChallengeRequest } from 'ledger/schemas'
import { getDataLength } from './utils'

/**
 * Parses and formats auth challenge data for signing by Ledger device.
 *
 * Takes a LedgerSignChallengeRequest and:
 * 1. Formats `dAppDefinitionAddress` and `origin` as hex encoded strings and combine them into hash to sign
 * 2. Returns hexadecimal challenge data and blake2b hash for signing
 *
 * @param params - Challenge request parameters including:
 *   - challenge: Challenge string to sign
 *   - dAppDefinitionAddress: dApp address
 *   - origin: Origin URL of the dApp
 * @returns Object containing:
 *   - challengeData: Formatted data string with length prefix
 *   - hashToSign: Blake2b hash of the data
 */

export const parseSignAuth = (
  params: Omit<LedgerSignChallengeRequest, 'discriminator' | 'interactionId'>,
) => {
  const addressLength = params.dAppDefinitionAddress.length.toString(16)
  const encodedDappAddress = Buffer.from(
    params.dAppDefinitionAddress,
    'utf-8',
  ).toString('hex')
  const encodedOrigin = Buffer.from(params.origin, 'utf-8').toString('hex')
  const data =
    params.challenge + addressLength + encodedDappAddress + encodedOrigin
  const dataLength = getDataLength(data)
  return {
    challengeData: `${dataLength}${data}`,
    hashToSign: blakeHashHexSync(
      `${params.challenge}${addressLength}${encodedDappAddress}${encodedOrigin}`,
    ),
  }
}
