export type Address = Keys
export type Hex = string
export type Path = string

export type Account = {
  usedAddresses: Address[]
  freshAddresses: Address[]
}
export const Curve = {
  ed25519: 'ed25519',
  secp256k1: 'secp256k1',
} as const

export type CoinDetails = {
  purpose: number
  coinType: number
  curve: keyof typeof Curve
}

export type Keys = {
  accountIndex?: number
  addressIndex?: number
  path: Path
  chainCode?: Hex
  publicKey: Hex
  privateKey: Hex
}
