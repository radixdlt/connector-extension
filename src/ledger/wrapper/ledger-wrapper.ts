import TransportWebHID from '@ledgerhq/hw-transport-webhid'
import {
  DerivedPublicKey,
  KeyParameters,
  LedgerDeriveAndDisplayAddressRequest,
  LedgerDeviceIdRequest,
  LedgerPublicKeyRequest,
  LedgerSignChallengeRequest,
  LedgerSignTransactionRequest,
  SignatureOfSigner,
} from 'ledger/schemas'
import { ResultAsync, err, ok, okAsync } from 'neverthrow'
import { bufferToChunks } from 'utils'
import { offscreenLogger } from 'utils/logger'
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

export type ExchangeFn = (
  command: LedgerInstructionCode,
  data?: string,
  additionalParams?: AdditionalExchangeParams,
) => ResultAsync<string, string>

const getCurveConfig = ({ curve }: KeyParameters) =>
  ({
    curve25519: {
      publicKeyByteCount: 32,
      signatureByteCount: 64,
      signTx: LedgerInstructionCode.SignTxEd25519,
      signAuth: LedgerInstructionCode.SignAuthEd25519,
      getPublicKey: LedgerInstructionCode.GetPubKeyEd25519,
      deriveAndDisplay: LedgerInstructionCode.DeriveAndDisplayAddressEd25519,
    },
    secp256k1: {
      publicKeyByteCount: 33,
      signatureByteCount: 65,
      signTx: LedgerInstructionCode.SignTxSecp256k1,
      signAuth: LedgerInstructionCode.SignAuthSecp256k1,
      getPublicKey: LedgerInstructionCode.GetPubKeySecp256k1,
      deriveAndDisplay: LedgerInstructionCode.DeriveAndDisplayAddressSecp256k1,
    },
  })[curve]

export const LedgerWrapper = ({
  transport = TransportWebHID,
  ledgerSubjects = LedgerSubjects(),
}: LedgerOptions) => {
  let currentTransport: Transport | undefined
  let lastInteractionId: string | undefined
  const setProgressMessage = (message: string) =>
    ledgerSubjects.onProgressSubject.next(message)

  const createLedgerTransport = (): ResultAsync<
    { closeTransport: () => ResultAsync<void, string>; exchange: ExchangeFn },
    string
  > => {
    if (currentTransport) {
      setProgressMessage('Finalizing existing ledger communication')
      return ResultAsync.fromPromise(
        currentTransport.close().then(() => {
          currentTransport = undefined
        }),
        (e) => {
          offscreenLogger.error(e)
          return 'failedToCloseExistingTransport'
        },
      ).andThen(() => createLedgerTransport())
    }

    return ResultAsync.fromPromise(
      transport.list(),
      () => LedgerErrorCode.FailedToListLedgerDevices,
    )
      .andThen((devices) => {
        offscreenLogger.debug(
          'Found Ledger devices',
          devices.map(
            ({ productName, productId }) => `${productId}, ${productName}`,
          ),
        )
        if (devices.length > 1) {
          return err(LedgerErrorCode.MultipleLedgerConnected)
        }

        if (devices.length === 0) {
          setProgressMessage('Waiting for Ledger device connection')
        }

        ledgerSubjects.connectedDeviceIdSubject.next(devices?.[0]?.productId)

        return ok(undefined)
      })
      .andThen(() =>
        ResultAsync.fromPromise(
          transport.create(),
          () => LedgerErrorCode.FailedToCreateTransport,
        ).map((transport) => {
          currentTransport = transport
          setProgressMessage('Creating Ledger device connection')
          const exchange: ExchangeFn = (
            command: LedgerInstructionCode,
            data = '',
            {
              p1 = '00',
              instructionClass = LedgerInstructionClass.aa,
            }: AdditionalExchangeParams = {},
          ) => {
            const ledgerInput = `${instructionClass}${command}${p1}00${data}`
            offscreenLogger.debug('📒 sending', ledgerInput)
            return ResultAsync.fromPromise(
              transport.exchange(Buffer.from(ledgerInput, 'hex')),
              () => LedgerErrorCode.FailedToExchangeData,
            ).andThen((buffer) => {
              const stringifiedResponse = buffer.toString('hex')
              offscreenLogger.debug(`📒 received`, stringifiedResponse)
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
        setProgressMessage('')
        return error
      })

  const ensureCorrectDeviceId =
    (expectedDeviceId: string) => (ledgerDeviceId: string) => {
      setProgressMessage('Checking Ledger Device ID')

      return ledgerDeviceId === expectedDeviceId
        ? ok(undefined)
        : err(LedgerErrorCode.DeviceMismatch)
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

  const parseSignerParams = (
    signer: KeyParameters,
    params?: Omit<
      LedgerSignTransactionRequest,
      'discriminator' | 'interactionId'
    >,
  ) => {
    const {
      signTx,
      signatureByteCount,
      publicKeyByteCount,
      signAuth: signAuthCommand,
    } = getCurveConfig(signer)
    const encodedDerivationPath = encodeDerivationPath(signer.derivationPath)
    return {
      command: signTx,
      signAuthCommand,
      encodedDerivationPath,
      signatureByteCount,
      publicKeyByteCount,
    }
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

  const getPublicKeys = (
    params: Omit<LedgerPublicKeyRequest, 'discriminator' | 'interactionId'>,
  ): ResultAsync<DerivedPublicKey[], string> =>
    wrapDataExchange((exchange) =>
      exchange(LedgerInstructionCode.GetDeviceId)
        .andThen(ensureCorrectDeviceId(params.ledgerDevice.id))
        .andThen(parseGetPublicKeyParams(params))
        .andThen((keysParameters) => {
          setProgressMessage('Getting public keys...')
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
                setProgressMessage(
                  `Gathering ${index + 1} out of ${
                    params.signers.length
                  } signatures`,
                )

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
            (
              signersAcc: ResultAsync<SignatureOfSigner[], string>,
              signer,
              index,
            ) => {
              const {
                command,
                signatureByteCount,
                publicKeyByteCount,
                encodedDerivationPath,
              } = parseSignerParams(signer, params)
              const digestLength = 32 * 2
              return signersAcc.andThen((previousValue) => {
                setProgressMessage(
                  `Gathering ${index + 1} out of ${
                    params.signers.length
                  } signatures`,
                )
                return exchange(command, encodedDerivationPath, { p1 })
                  .andThen(() =>
                    apduChunks.reduce(
                      (
                        acc: ResultAsync<string, string>,
                        { chunk, instructionClass },
                      ) =>
                        acc.andThen(() =>
                          exchange(command, chunk, {
                            instructionClass,
                            p1,
                          }),
                        ),
                      okAsync(''),
                    ),
                  )
                  .andThen((result) => {
                    if (
                      result.length - digestLength !==
                      (signatureByteCount + publicKeyByteCount) * 2
                    ) {
                      offscreenLogger.error(
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
                      offscreenLogger.error(
                        `Signature length is ${signature.length} whereas it should be ${signatureByteCount} bytes * 2`,
                      )
                      return err('Signature has incorrect length.')
                    }

                    if (publicKey.length !== publicKeyByteCount * 2) {
                      offscreenLogger.error(
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
