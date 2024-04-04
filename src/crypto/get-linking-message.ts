import { blakeHashBufferToHex } from './blake2b'

export const getLinkingSignatureMessage = (password: Buffer) =>
  blakeHashBufferToHex(Buffer.concat([Buffer.from('L', 'ascii'), password]))
