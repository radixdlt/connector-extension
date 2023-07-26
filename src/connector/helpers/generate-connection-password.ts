import { config } from 'config'
import { secureRandom } from 'crypto/secure-random'

export const generateConnectionPassword = (
  byteLength = config.secrets.connectionPasswordByteLength,
) => secureRandom(byteLength)
