import TransportWebHID from '@ledgerhq/hw-transport-webhid'
import {
  DerivedPublicKey,
  KeyParameters,
  LedgerDeriveAndDisplayAddressRequest,
  LedgerDeviceIdRequest,
  LedgerPublicKeyRequest,
  LedgerSignChallengeRequest,
  LedgerSignSubintentHashRequest,
  LedgerSignTransactionRequest,
  SignatureOfSigner,
} from 'ledger/schemas'
import { ResultAsync, err, ok, okAsync } from 'neverthrow'
import { bufferToChunks } from 'utils'
import { logger as utilsLogger } from 'utils/logger'
import {
  LedgerErrorCode,
  LedgerInstructionCode,
  LedgerInstructionClass,
} from './constants'
import { encodeDerivationPath } from './encode-derivation-path'
import { getDataLength } from './utils'
import { LedgerSubjects } from './subjects'
import { parseSignAuth } from './parse-sign-auth'
import Transport from '@ledgerhq/hw-transport'

export const ledgerLogger = utilsLogger.getSubLogger({ name: 'ledger' })

export type LedgerOptions = Partial<{
  transport: typeof TransportWebHID
  ledgerSubjects: ReturnType<typeof LedgerSubjects>
}>

export type AdditionalExchangeParams = {
  p1?: string
  instructionClass?: LedgerInstructionClass
}

const ledgerModel: Record<string, string> = {
  '00': 'nanoS',
  '01': 'nanoS+',
  '02': 'nanoX',
}

/**
 * Send specific hex string to the Ledger device and return the response.
 */
export type ExchangeFn = (
  command: LedgerInstructionCode,
  data?: string,
  additionalParams?: AdditionalExchangeParams,
) => ResultAsync<string, string>

/**
 * Radix Wallet supports two types of curves: Curve25519 and secp256k1.
 * This function returns the configuration which is dependent on the curve.
 */
const getCurveConfig = ({ curve }: KeyParameters) =>
  ({
    curve25519: {
      publicKeyByteCount: 32,
      signatureByteCount: 64,
      signPreAuth: LedgerInstructionCode.SignPreAuthHashEd25519,
      signTx: LedgerInstructionCode.SignTxEd25519,
      signAuth: LedgerInstructionCode.SignAuthEd25519,
      getPublicKey: LedgerInstructionCode.GetPubKeyEd25519,
      deriveAndDisplay: LedgerInstructionCode.DeriveAndDisplayAddressEd25519,
    },
    secp256k1: {
      publicKeyByteCount: 33,
      signatureByteCount: 65,
      signPreAuth: LedgerInstructionCode.SignPreAuthHashSecp256k1,
      signTx: LedgerInstructionCode.SignTxSecp256k1,
      signAuth: LedgerInstructionCode.SignAuthSecp256k1,
      getPublicKey: LedgerInstructionCode.GetPubKeySecp256k1,
      deriveAndDisplay: LedgerInstructionCode.DeriveAndDisplayAddressSecp256k1,
    },
  })[curve]

/**
 * Main module used for interacting with the Ledger device. It initializes and keeps track
 * of transport layer and provides highest level methods for interacting with the Ledger device.
 *
 * There is single communication pipe with Ledger device whereas there might be multiple
 * (or duplicated) requests to this module. `lastInteractionId` is always saved when new requests goes in
 */
export const LedgerWrapper = ({
  transport = TransportWebHID,
  ledgerSubjects = LedgerSubjects(),
}: LedgerOptions) => {
  let currentTransport: Transport | undefined
  let lastInteractionId: string | undefined
  const setProgressMessage = (message: string) =>
    ledgerSubjects.onProgressSubject.next(message)

  const listLedgerDevices = () =>
    ResultAsync.fromPromise(
      transport.list(),
      () => LedgerErrorCode.FailedToListLedgerDevices,
    ).andThen((devices) => {
      ledgerLogger.debug(
        'Found Ledger devices',
        devices.map(
          ({ productName, productId }) => `${productId}, ${productName}`,
        ),
      )
      if (devices.length > 1) {
        return err(LedgerErrorCode.MultipleLedgerConnected)
      }

      ledgerSubjects.connectedDeviceIdSubject.next(devices?.[0]?.productId)

      return ok(undefined)
    })

  const createLedgerTransport = (): ResultAsync<
    { closeTransport: () => ResultAsync<void, string>; exchange: ExchangeFn },
    string
  > => {
    if (currentTransport) {
      ledgerLogger.debug('📒 closing current transport')
      return ResultAsync.fromPromise(
        currentTransport.close().then(() => {
          currentTransport = undefined
        }),
        (e) => {
          ledgerLogger.error(e)
          return 'failedToCloseExistingTransport'
        },
      ).andThen(() => createLedgerTransport())
    }

    return listLedgerDevices().andThen(() =>
      ResultAsync.fromPromise(
        transport.create(),
        () => LedgerErrorCode.FailedToCreateTransport,
      )
        .andThen((transport) => {
          ledgerLogger.debug('📒 transport layer created')
          return listLedgerDevices().map(() => transport)
        })
        .map((transport) => {
          currentTransport = transport
          setProgressMessage(' ')
          const exchange: ExchangeFn = (
            command: LedgerInstructionCode,
            data = '',
            {
              p1 = '00',
              instructionClass = LedgerInstructionClass.aa,
            }: AdditionalExchangeParams = {},
          ) => {
            const ledgerInput = `${instructionClass}${command}${p1}00${data}`
            ledgerLogger.debug('📒 sending', ledgerInput)
            return ResultAsync.fromPromise(
              transport.exchange(Buffer.from(ledgerInput, 'hex')),
              () => LedgerErrorCode.FailedToExchangeData,
            ).andThen((buffer) => {
              const stringifiedResponse = buffer.toString('hex')
              ledgerLogger.debug(`📒 received`, stringifiedResponse)
              const statusCode = stringifiedResponse.slice(-4)
              if (statusCode !== '9000') {
                return err(statusCode)
              }
              return ok(stringifiedResponse.slice(0, -4))
            })
          }

          return {
            closeTransport: () => {
              setProgressMessage('')
              ledgerSubjects.connectedDeviceIdSubject.next(undefined)
              currentTransport = undefined
              return ResultAsync.fromPromise(
                transport.close(),
                () => 'failedClosingTransport',
              )
            },
            exchange,
          }
        }),
    )
  }

  /**
   *  Wraps the exchange function to ensure that the transport layer is closed after the exchange is done.
   *  It accepts a function that takes the exchange function as an argument and returns a ResultAsync.
   *  `exchangeFn` is a function that is capable of data to the Ledger device and returns a ResultAsync.
   */
  const wrapDataExchange = (
    fn: (exchangeFn: ExchangeFn) => ResultAsync<any, string>,
  ) =>
    createLedgerTransport()
      .andThen(({ closeTransport, exchange }) =>
        fn(exchange)
          .andThen((response) => closeTransport().map(() => response))
          .mapErr((error) => {
            closeTransport()
            return error
          }),
      )
      .mapErr((error) => {
        ledgerSubjects.connectedDeviceIdSubject.next(undefined)
        setProgressMessage('')
        return error
      })

  /**
   * Each time Radix Wallet is asking for ledger data it sends specific ledger identifier with the request.
   * This is the reason connector extension asks Ledger Babylon App for public key using `getPublicKeys`
   * method before anything else happens
   */
  const ensureCorrectDeviceId =
    (expectedDeviceId: string) => (ledgerDeviceId: string) => {
      if (ledgerDeviceId === expectedDeviceId) {
        return ok(undefined)
      } else {
        return err(LedgerErrorCode.DeviceMismatch)
      }
    }

  const parseGetPublicKeyParams =
    (params: Omit<LedgerPublicKeyRequest, 'discriminator' | 'interactionId'>) =>
    () =>
      ok(
        params.keysParameters.map((keyParameter) => {
          const { getPublicKey } = getCurveConfig(keyParameter)
          const encodedDerivationPath = encodeDerivationPath(
            keyParameter.derivationPath,
          )
          return {
            ...keyParameter,
            getPublicKey,
            encodedDerivationPath,
          }
        }),
      )

  const parseSignerParams = (signer: KeyParameters) => {
    const {
      signTx,
      signPreAuth,
      signatureByteCount,
      publicKeyByteCount,
      signAuth: signAuthCommand,
    } = getCurveConfig(signer)
    const encodedDerivationPath = encodeDerivationPath(signer.derivationPath)
    return {
      command: signTx,
      signPreAuth,
      signAuthCommand,
      encodedDerivationPath,
      signatureByteCount,
      publicKeyByteCount,
    }
  }

  const parsePreAuthorizationParams = (
    params: Omit<
      LedgerSignSubintentHashRequest,
      'discriminator' | 'interactionId'
    >,
  ) => {
    const dataLength = getDataLength(params.subintentHash)
    return okAsync({ hash: `${dataLength}${params.subintentHash}` })
  }

  const parseSignTransactionParams =
    (
      params: Omit<
        LedgerSignTransactionRequest,
        'discriminator' | 'interactionId'
      >,
    ) =>
    () => {
      const compiledTxIntentChunksResult = bufferToChunks(
        Buffer.from(params.compiledTransactionIntent, 'hex'),
        255,
      )
      if (compiledTxIntentChunksResult.isErr())
        return err('error chunking data')

      const apduChunks = compiledTxIntentChunksResult.value.map(
        (chunk, index) => {
          const stringifiedChunk = chunk.toString('hex')
          const chunkLength = getDataLength(stringifiedChunk)
          const chunkWithLength = `${chunkLength}${stringifiedChunk}`
          return {
            chunk: chunkWithLength,
            instructionClass:
              index === compiledTxIntentChunksResult.value.length - 1
                ? LedgerInstructionClass.ac
                : LedgerInstructionClass.ab,
          }
        },
      )

      const p1 = params.displayHash ? '01' : '00'
      return ok({ p1, apduChunks })
    }

  /**
   * Gets identification information from Ledger
   *
   * @returns ResultAsync with `deviceId` and `model` inside object
   */
  const getDeviceInfo = (): ResultAsync<
    { deviceId: string; model: string },
    string
  > =>
    wrapDataExchange((exchange) =>
      exchange(LedgerInstructionCode.GetDeviceId).andThen((deviceId) =>
        exchange(LedgerInstructionCode.GetDeviceModel).map((model) => ({
          id: deviceId,
          model: ledgerModel[model],
        })),
      ),
    )

  /**
   * Derives public keys for one or more provided derivation paths and curves.
   *
   * @returns ResultAsync with list of objects. Objects containing `publicKey`,`derivationPath`,`curve`
   */
  const getPublicKeys = (
    params: Omit<LedgerPublicKeyRequest, 'discriminator' | 'interactionId'>,
  ): ResultAsync<DerivedPublicKey[], string> =>
    wrapDataExchange((exchange) =>
      exchange(LedgerInstructionCode.GetDeviceId)
        .andThen(ensureCorrectDeviceId(params.ledgerDevice.id))
        .andThen(parseGetPublicKeyParams(params))
        .andThen((keysParameters) => {
          return keysParameters.reduce(
            (
              acc: ResultAsync<DerivedPublicKey[], string>,
              { getPublicKey, encodedDerivationPath, curve, derivationPath },
            ) =>
              acc.andThen((derivedPublicKeys) =>
                exchange(getPublicKey, encodedDerivationPath).map(
                  (publicKey) => [
                    ...derivedPublicKeys,
                    { publicKey, derivationPath, curve },
                  ],
                ),
              ),
            okAsync([]),
          )
        }),
    )

  const deriveAndDisplayAddress = (
    params: Omit<
      LedgerDeriveAndDisplayAddressRequest,
      'discriminator' | 'interactionId'
    >,
  ) =>
    wrapDataExchange((exchange) =>
      exchange(LedgerInstructionCode.GetDeviceId)
        .andThen(ensureCorrectDeviceId(params.ledgerDevice.id))
        .andThen(() => {
          const keyParameter = params.keyParameters
          const { deriveAndDisplay, getPublicKey } =
            getCurveConfig(keyParameter)
          const encodedDerivationPath = encodeDerivationPath(
            keyParameter.derivationPath,
          )

          return exchange(getPublicKey, encodedDerivationPath).andThen(
            (publicKey) =>
              exchange(deriveAndDisplay, encodedDerivationPath).map(
                (result) => ({
                  derivedKey: {
                    ...keyParameter,
                    publicKey,
                  },
                  address: Buffer.from(result, 'hex').toString(),
                }),
              ),
          )
        }),
    )

  /**
   * Signs auth challenge with provided curves and derivation paths
   * @returns List of signatures `SignatureOfSigner`
   */
  const signAuth = (
    params: Omit<LedgerSignChallengeRequest, 'discriminator' | 'interactionId'>,
  ): ResultAsync<SignatureOfSigner[], string> =>
    wrapDataExchange((exchange) =>
      exchange(LedgerInstructionCode.GetDeviceId)
        .andThen(ensureCorrectDeviceId(params.ledgerDevice.id))
        .map(() => parseSignAuth(params))
        .andThen(({ challengeData }) =>
          params.signers.reduce(
            (acc: ResultAsync<SignatureOfSigner[], string>, signer, index) =>
              acc.andThen((signatures) => {
                const {
                  signAuthCommand,
                  signatureByteCount,
                  publicKeyByteCount,
                  encodedDerivationPath,
                } = parseSignerParams(signer)

                return exchange(signAuthCommand, encodedDerivationPath)
                  .andThen(() =>
                    exchange(signAuthCommand, challengeData, {
                      instructionClass: LedgerInstructionClass.ac,
                    }),
                  )
                  .andThen((result) => {
                    const publicKey = result.slice(
                      signatureByteCount * 2,
                      signatureByteCount * 2 + publicKeyByteCount * 2,
                    )

                    const signature = result.slice(0, signatureByteCount * 2)

                    return ok({
                      signature,
                      publicKey,
                    })
                  })
                  .map(({ signature, publicKey }) => {
                    const entry: SignatureOfSigner = {
                      derivedPublicKey: {
                        ...signer,
                        publicKey,
                      },
                      signature,
                    }
                    return [...signatures, entry]
                  })
              }),
            okAsync([]),
          ),
        ),
    )

  /**
   * Signs subintent (preauthorization) with provided curves and derivation paths
   * @returns List of signatures `SignatureOfSigner`
   */
  const signSubintent = (
    params: Omit<
      LedgerSignSubintentHashRequest,
      'discriminator' | 'interactionId'
    >,
  ): ResultAsync<SignatureOfSigner[], string> =>
    wrapDataExchange((exchange) =>
      exchange(LedgerInstructionCode.GetDeviceId)
        .andThen(ensureCorrectDeviceId(params.ledgerDevice.id))
        .andThen(() => parsePreAuthorizationParams(params))
        .andThen(({ hash }) =>
          params.signers.reduce(
            (acc: ResultAsync<SignatureOfSigner[], string>, signer, index) =>
              acc.andThen((signatures) => {
                const {
                  signPreAuth,
                  signatureByteCount,
                  publicKeyByteCount,
                  encodedDerivationPath,
                } = parseSignerParams(signer)

                return exchange(signPreAuth, encodedDerivationPath)
                  .andThen(() =>
                    exchange(signPreAuth, hash, {
                      instructionClass: LedgerInstructionClass.ac,
                    }),
                  )
                  .andThen((result) => {
                    const publicKey = result.slice(
                      signatureByteCount * 2,
                      signatureByteCount * 2 + publicKeyByteCount * 2,
                    )

                    const signature = result.slice(0, signatureByteCount * 2)

                    return ok({
                      signature,
                      publicKey,
                    })
                  })
                  .map(({ signature, publicKey }) => {
                    const entry: SignatureOfSigner = {
                      derivedPublicKey: {
                        ...signer,
                        publicKey,
                      },
                      signature,
                    }
                    return [...signatures, entry]
                  })
              }),
            okAsync([]),
          ),
        ),
    )

  /**
   * Gathers all required signatures for a single transaction signing.
   * If there are more then X signatures this function will send an event
   * through `ledgerSubjects.onProgressSubject` with the current progress.
   * @param params
   * @returns List of signatures `SignatureOfSigner`
   */
  const signTransaction = (
    params: Omit<
      LedgerSignTransactionRequest,
      'discriminator' | 'interactionId'
    >,
  ): ResultAsync<SignatureOfSigner[], string> =>
    wrapDataExchange((exchange) =>
      exchange(LedgerInstructionCode.GetDeviceId)
        .andThen(ensureCorrectDeviceId(params.ledgerDevice.id))
        .andThen(parseSignTransactionParams(params))
        .andThen(({ p1, apduChunks }) =>
          params.signers.reduce(
            (signersAcc: ResultAsync<SignatureOfSigner[], string>, signer) => {
              const {
                command,
                signatureByteCount,
                publicKeyByteCount,
                encodedDerivationPath,
              } = parseSignerParams(signer)
              const digestLength = 32 * 2
              return signersAcc.andThen((previousValue) => {
                return exchange(command, encodedDerivationPath, { p1 })
                  .andThen(() =>
                    apduChunks.reduce(
                      (
                        acc: ResultAsync<string, string>,
                        { chunk, instructionClass },
                        index,
                      ) => {
                        return acc.andThen(() => {
                          if (apduChunks.length > 30) {
                            setProgressMessage(
                              `Please wait a moment - this is a large transaction... (${Math.round(
                                ((index + 1) / apduChunks.length) * 100,
                              )} %)`,
                            )
                          }

                          return exchange(command, chunk, {
                            instructionClass,
                            p1,
                          })
                        })
                      },

                      okAsync(''),
                    ),
                  )
                  .andThen((result) => {
                    if (
                      result.length - digestLength !==
                      (signatureByteCount + publicKeyByteCount) * 2
                    ) {
                      ledgerLogger.error(
                        `Result length is ${result.length} whereas it should be (signature) ${signatureByteCount} bytes * 2 + (publicKey) ${publicKeyByteCount} bytes * 2 + digest length: ${digestLength}`,
                      )
                      return err(
                        'Result containing signature and PublicKey has incorrect length.',
                      )
                    }

                    const signature = result.slice(0, signatureByteCount * 2)
                    const sigOffset = signatureByteCount * 2
                    const publicKey = result.slice(
                      sigOffset,
                      sigOffset + 2 * publicKeyByteCount,
                    )

                    if (signature.length !== signatureByteCount * 2) {
                      ledgerLogger.error(
                        `Signature length is ${signature.length} whereas it should be ${signatureByteCount} bytes * 2`,
                      )
                      return err('Signature has incorrect length.')
                    }

                    if (publicKey.length !== publicKeyByteCount * 2) {
                      ledgerLogger.error(
                        `Public Key length is ${publicKey.length} whereas it should be ${publicKeyByteCount} bytes * 2`,
                      )
                      return err('PublicKey has incorrect length.')
                    }

                    return ok({
                      signature,
                      publicKey,
                    })
                  })
                  .map((result) => [
                    ...previousValue,
                    {
                      signature: result.signature,
                      derivedPublicKey: {
                        publicKey: result.publicKey,
                        derivationPath: signer.derivationPath,
                        curve: signer.curve,
                      },
                    },
                  ])
              })
            },
            okAsync([]),
          ),
        ),
    )

  return {
    signAuth: (params: LedgerSignChallengeRequest) => {
      lastInteractionId = params.interactionId
      return signAuth(params)
    },
    getPublicKeys: (params: LedgerPublicKeyRequest) => {
      lastInteractionId = params.interactionId
      return getPublicKeys(params)
    },
    getDeviceInfo: (params: LedgerDeviceIdRequest) => {
      lastInteractionId = params.interactionId
      return getDeviceInfo()
    },
    signTransaction: (params: LedgerSignTransactionRequest) => {
      lastInteractionId = params.interactionId
      return signTransaction(params)
    },
    signSubintent: (params: LedgerSignSubintentHashRequest) => {
      lastInteractionId = params.interactionId
      return signSubintent(params)
    },
    deriveAndDisplayAddress: (params: LedgerDeriveAndDisplayAddressRequest) => {
      lastInteractionId = params.interactionId
      return deriveAndDisplayAddress(params)
    },
    getLastInteractionId: () => lastInteractionId,
    progress$: ledgerSubjects.onProgressSubject.asObservable(),
    connectedDeviceId$: ledgerSubjects.connectedDeviceIdSubject.asObservable(),
  }
}

export const ledger = LedgerWrapper({})
