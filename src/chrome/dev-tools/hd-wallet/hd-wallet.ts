import { Slip10Derivation } from './slip0010'

import { mnemonicToSeedSync, validateMnemonic } from 'bip39'

import { Address, CoinDetails, Curve, Keys } from './models'

export const createRadixWallet = ({ seed, curve }: any) =>
  new BaseHdWallet(seed, {
    curve,
    coinType: 1022,
    purpose: 44,
  })

export class BaseHdWallet {
  public readonly mnemonic: string | null
  public readonly seed: string | Buffer
  public readonly cryptocurrency: string | null
  public readonly purpose: number
  public readonly coinType: number
  public readonly curve: keyof typeof Curve
  public readonly masterKey: Address

  private slip10: any

  public constructor(mnemonicOrSeed: string, coinDetails: CoinDetails) {
    if (validateMnemonic(mnemonicOrSeed)) {
      this.mnemonic = mnemonicOrSeed
      this.seed = mnemonicToSeedSync(this.mnemonic).toString('hex')
    } else if (mnemonicOrSeed.length >= 32 && mnemonicOrSeed.length <= 128) {
      this.mnemonic = null
      this.seed = mnemonicOrSeed
    } else {
      throw new Error(
        `Invalid seed: Seed Length has to be between 32 (128 bits) and 128 (516 bits) \nSeed: ${mnemonicOrSeed} \nSeedLength: ${mnemonicOrSeed.length}`
      )
    }

    this.cryptocurrency = null
    const { purpose, coinType, curve } = coinDetails

    this.purpose = purpose
    this.coinType = coinType
    this.curve = curve

    this.slip10 = new Slip10Derivation(this.curve, this.seed)
    this.masterKey = this.slip10.masterKey
  }

  public derivePath(path: string): Keys {
    return this.slip10.derivePath(
      `m/${this.purpose}'/${this.coinType}'/${path}`
    )
  }

  public deriveFullPath(path: string): Keys {
    return this.slip10.derivePath(path.split('H').join(`'`))
  }
}
