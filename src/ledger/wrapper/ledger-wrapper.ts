import TransportWebHID from '@ledgerhq/hw-transport-webhid'
import {
  DerivedPublicKey,
  KeyParameters,
  LedgerImportOlympiaDeviceRequest,
  LedgerPublicKeyRequest,
  LedgerSignTransactionRequest,
  SignatureOfSigner,
} from 'ledger/schemas'
import { ResultAsync, err, ok, okAsync } from 'neverthrow'
import { bufferToChunks } from 'utils'
import { logger } from 'utils/logger'
import {
  LedgerErrorResponse,
  LedgerInstructionCode,
  LedgerInstructionClass,
  errorResponses,
} from './contants'
import { encodeDerivationPath } from './encode-derivation-path'
import { getDataLength } from './utils'
import { LedgerSubjects } from './subjects'

export type LedgerOptions = Partial<{
  transport: typeof TransportWebHID
  ledgerSubjects: ReturnType<typeof LedgerSubjects>
}>

export type AdditionalExchangeParams = {
  p1?: string
  instructionClass?: LedgerInstructionClass
}

export type ExchangeFn = (
  command: LedgerInstructionCode,
  data?: string,
  additionalParams?: AdditionalExchangeParams
) => ResultAsync<string, string>

const getCurveConfig = ({ curve }: KeyParameters) =>
  ({
    curve25519: {
      publicKeyByteCount: 32,
      signatureByteCount: 64,
      signTx: LedgerInstructionCode.SignTxEd255519,
      getPublicKey: LedgerInstructionCode.GetPubKeyEd25519,
      signTxSmart: LedgerInstructionCode.SignTxEd255519Smart,
    },
    secp256k1: {
      publicKeyByteCount: 33,
      signatureByteCount: 65,
      signTx: LedgerInstructionCode.SignTxSecp256k1,
      getPublicKey: LedgerInstructionCode.GetPubKeySecp256k1,
      signTxSmart: LedgerInstructionCode.SignTxSecp256k1Smart,
    },
  }[curve])

export const LedgerWrapper = ({
  transport = TransportWebHID,
  ledgerSubjects = LedgerSubjects(),
}: LedgerOptions) => {
  const setProgressMessage = (message: string) =>
    ledgerSubjects.onProgressSubject.next(message)

  const createLedgerTransport = () =>
    ResultAsync.fromPromise(
      transport.list(),
      () => LedgerErrorResponse.FailedToListLedgerDevices
    )
      .andThen((devices) => {
        if (devices.length > 1) {
          return err(LedgerErrorResponse.MultipleLedgerConnected)
        }

        if (devices.length === 0) {
          setProgressMessage('Waiting for Ledger device connection')
        }

        return ok(undefined)
      })
      .andThen(() =>
        ResultAsync.fromPromise(
          transport.create(),
          () => LedgerErrorResponse.FailedToCreateTransport
        ).map((transport) => {
          setProgressMessage('Creating Ledger device connection')
          const exchange: ExchangeFn = (
            command: LedgerInstructionCode,
            data = '',
            {
              p1 = '00',
              instructionClass = LedgerInstructionClass.aa,
            }: AdditionalExchangeParams = {}
          ) => {
            const ledgerInput = `${instructionClass}${command}${p1}00${data}`
            return ResultAsync.fromPromise(
              transport.exchange(Buffer.from(ledgerInput, 'hex')),
              () => errorResponses[LedgerErrorResponse.FailedToExchangeData]
            ).andThen((buffer) => {
              const stringifiedResponse = buffer.toString('hex')
              logger.debug(`📒 Ledger`, {
                input: ledgerInput,
                output: stringifiedResponse,
              })
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
              return ResultAsync.fromSafePromise(transport.close())
            },
            exchange,
          }
        })
      )

  const wrapDataExchange = (
    fn: (exchangeFn: ExchangeFn) => ResultAsync<any, string>
  ) =>
    createLedgerTransport()
      .andThen(({ closeTransport, exchange }) =>
        fn(exchange)
          .andThen((response) => closeTransport().map(() => response))
          .mapErr((error) => {
            closeTransport()
            return error
          })
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
        : err(LedgerErrorResponse.DeviceMismatch)
    }

  const parseGetPublicKeyParams =
    (params: Omit<LedgerPublicKeyRequest, 'discriminator' | 'interactionId'>) =>
    () => {
      const { getPublicKey } = getCurveConfig(params.keyParameters)
      const encodedDerivationPath = encodeDerivationPath(
        params.keyParameters.derivationPath
      )
      return ok({ command: getPublicKey, encodedDerivationPath })
    }

  const parseSignerParams = (
    signer: KeyParameters,
    params: Omit<
      LedgerSignTransactionRequest,
      'discriminator' | 'interactionId'
    >
  ) => {
    const { signTx, signTxSmart, signatureByteCount, publicKeyByteCount } =
      getCurveConfig(signer)
    const command = params.mode === 'summary' ? signTxSmart : signTx

    const encodedDerivationPath = encodeDerivationPath(signer.derivationPath)
    return {
      command,
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
      >
    ) =>
    () => {
      const compiledTxIntentChunksResult = bufferToChunks(
        Buffer.from(params.compiledTransactionIntent, 'hex'),
        255
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
        }
      )

      const p1 = params.displayHash ? '01' : '00'
      return ok({ p1, apduChunks })
    }

  const getOlympiaDeviceInfo = ({
    derivationPaths,
  }: Pick<LedgerImportOlympiaDeviceRequest, 'derivationPaths'>): ResultAsync<
    {
      id: string
      model: string
      derivedPublicKeys: DerivedPublicKey[]
    },
    string
  > =>
    wrapDataExchange((exchange) =>
      exchange(LedgerInstructionCode.GetDeviceId).andThen((id) =>
        exchange(LedgerInstructionCode.GetDeviceModel).andThen((model) =>
          derivationPaths
            .reduce(
              (acc: ResultAsync<DerivedPublicKey[], string>, path, index) => {
                const encodedDerivationPath = encodeDerivationPath(path)

                return acc.andThen((publicKeys) => {
                  setProgressMessage(
                    `Importing ${index + 1} out of ${
                      derivationPaths.length
                    } olympia accounts`
                  )
                  return exchange(
                    LedgerInstructionCode.GetPubKeySecp256k1,
                    encodedDerivationPath
                  ).map((publicKey) => [...publicKeys, { publicKey, path }])
                })
              },
              okAsync([])
            )
            .map((derivedPublicKeys) => ({
              id,
              model,
              derivedPublicKeys,
            }))
        )
      )
    )

  const getDeviceInfo = (): ResultAsync<
    { deviceId: string; model: string },
    string
  > =>
    wrapDataExchange((exchange) =>
      exchange(LedgerInstructionCode.GetDeviceId).andThen((deviceId) =>
        exchange(LedgerInstructionCode.GetDeviceModel).map((model) => ({
          deviceId,
          model,
        }))
      )
    )

  const getPublicKey = (
    params: Omit<LedgerPublicKeyRequest, 'discriminator' | 'interactionId'>
  ): ResultAsync<string, string> =>
    wrapDataExchange((exchange) =>
      exchange(LedgerInstructionCode.GetDeviceId)
        .andThen(ensureCorrectDeviceId(params.ledgerDevice.id))
        .andThen(parseGetPublicKeyParams(params))
        .andThen(({ command, encodedDerivationPath }) => {
          setProgressMessage('Getting public key...')
          return exchange(command, encodedDerivationPath)
        })
    )

  const signTransaction = (
    params: Omit<
      LedgerSignTransactionRequest,
      'discriminator' | 'interactionId'
    >
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
              index
            ) => {
              const {
                command,
                signatureByteCount,
                publicKeyByteCount,
                encodedDerivationPath,
              } = parseSignerParams(signer, params)

              return signersAcc.andThen((previousValue) => {
                setProgressMessage(
                  `Gathering ${index + 1} out of ${
                    params.signers.length
                  } signatures`
                )
                return exchange(command, encodedDerivationPath, { p1 })
                  .andThen(() =>
                    apduChunks.reduce(
                      (
                        acc: ResultAsync<string, string>,
                        { chunk, instructionClass }
                      ) =>
                        acc.andThen(() =>
                          exchange(command, chunk, {
                            instructionClass,
                            p1,
                          })
                        ),
                      okAsync('')
                    )
                  )
                  .andThen((result) => {
                    if (
                      result.length !==
                      (signatureByteCount + publicKeyByteCount) * 2
                    ) {
                      return err(
                        'Result containing signature and PublicKey has incorrect length.'
                      )
                    }

                    const signature = result.slice(0, signatureByteCount * 2)
                    const sigOffset = signatureByteCount * 2
                    const publicKey = result.slice(
                      sigOffset,
                      sigOffset + 2 * publicKeyByteCount + 1
                    )

                    if (signature.length !== signatureByteCount * 2) {
                      return err('Signature has incorrect length.')
                    }

                    if (publicKey.length !== publicKeyByteCount * 2) {
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
                      ...result,
                      derivationPath: signer.derivationPath,
                      curve: signer.curve,
                    },
                  ])
              })
            },
            okAsync([])
          )
        )
    )

  return {
    progress$: ledgerSubjects.onProgressSubject.asObservable(),
    getOlympiaDeviceInfo,
    getDeviceInfo,
    getPublicKey,
    signTransaction,
  }
}

export const ledger = LedgerWrapper({})
