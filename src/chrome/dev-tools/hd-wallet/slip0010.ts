import {
  derivePath as deriveEd25519Path,
  getMasterKeyFromSeed as getEd25519MasterKeyFromSeed,
  getPublicKey as computeEd25519PublicKey,
} from 'ed25519-hd-key'

import { BIP32Interface, fromSeed as bip32FromSeed } from 'bip32'

import { Address, Curve, Path, Hex } from './models'

type Keys = {
  key: Buffer
  chainCode: Buffer
}

type DerivationSchemeInterface = {
  masterKey: Address
  derivePath: (path: Path) => Address
}

abstract class Derivation implements DerivationSchemeInterface {
  public readonly curve: keyof typeof Curve
  protected readonly seedBuffer: Buffer

  public constructor(_curve: keyof typeof Curve, _seed: Hex | Buffer) {
    this.curve = _curve
    if (typeof _seed === 'string') {
      this.seedBuffer = Buffer.from(_seed, 'hex')
    } else {
      this.seedBuffer = _seed
    }

    if (!(this.seedBuffer.length >= 16 && this.seedBuffer.length <= 64)) {
      throw new Error(
        `Invalid seed: Seed has to be between 128 and 516 bits \nSeed: ${this.seed} \nSeedLength: ${this.seedBuffer.length}`
      )
    }
  }

  public derivePath(path: Path) {
    if (path === 'm') {
      return this.masterKey
    }
    return this.curveSpecificDerivation(path)
  }

  protected abstract formatKeys(keys: any, path: Path): Address
  protected abstract curveSpecificDerivation(path: Path): Address
  public abstract get masterKey(): Address

  public get seed() {
    return this.seedBuffer.toString('hex')
  }
}

class Ed25519 extends Derivation {
  public constructor(seed: Hex | Buffer) {
    super('ed25519', seed)
  }

  public formatKeys({ key, chainCode }: Keys, path: Path) {
    return {
      path,
      publicKey: this.computePublicKey(key),
      chainCode: chainCode.toString('hex'),
      privateKey: key.toString('hex'),
    }
  }

  public curveSpecificDerivation(path: Path) {
    const addressKeys = deriveEd25519Path(path, this.seed)
    return this.formatKeys(addressKeys, path)
  }

  public get masterKey() {
    const masterKeys = getEd25519MasterKeyFromSeed(this.seed)
    return this.formatKeys(masterKeys, 'm')
  }

  private computePublicKey(privateKey: Hex | Buffer, withZeroByte = false) {
    return computeEd25519PublicKey(
      typeof privateKey === 'string'
        ? Buffer.from(privateKey, 'hex')
        : (Uint8Array.from(privateKey) as Buffer),
      withZeroByte
    ).toString('hex')
  }
}

class Secp256k1 extends Derivation {
  private bip32: BIP32Interface
  public constructor(seed: Hex | Buffer) {
    super('secp256k1', seed)
    this.bip32 = bip32FromSeed(this.seedBuffer)
  }

  public formatKeys(bip32Address: BIP32Interface, path: Path) {
    if (!bip32Address.privateKey) throw new Error('Private Key is Invalid')
    return {
      path,
      publicKey: bip32Address.publicKey.toString('hex'),
      chainCode: bip32Address.chainCode.toString('hex'),
      privateKey: bip32Address.privateKey.toString('hex'),
    }
  }

  public curveSpecificDerivation(path: Path) {
    const bip32address = this.bip32.derivePath(path)
    return this.formatKeys(bip32address, path)
  }

  public get masterKey() {
    return this.formatKeys(this.bip32, 'm')
  }
}

export class Slip10Derivation implements DerivationSchemeInterface {
  public curve: keyof typeof Curve
  public seed: string
  private derivationScheme: Derivation

  public constructor(_curve: keyof typeof Curve, _seed: Hex) {
    this.curve = _curve
    this.seed = _seed

    switch (_curve) {
      case Curve.ed25519:
        this.derivationScheme = new Ed25519(_seed) as Derivation
        break
      case Curve.secp256k1:
        this.derivationScheme = new Secp256k1(_seed) as Derivation
        break
      default:
        throw new Error(`Curve '${_curve}' not supported`)
    }
  }

  public derivePath(path: Path) {
    return this.derivationScheme.derivePath(path)
  }

  public get masterKey() {
    return this.derivationScheme.masterKey
  }
}
