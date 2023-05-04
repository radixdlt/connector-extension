import TransportWebHID from '@ledgerhq/hw-transport-webhid'
import {
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
import { isKnownError, getDataLength } from './utils'
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

export const LedgerWrapper = ({
  transport = TransportWebHID,
  ledgerSubjects = LedgerSubjects(),
}: LedgerOptions) => {
  const setProgressMessage = (message: string) =>
    ledgerSubjects.onProgressSubject.next(message)

  const createLedgerTransport = () =>
    ResultAsync.fromPromise(
      transport.list(),
      () => LedgerErrorResponse.FailedToCreateTransport
    )
      .andThen((devices) => {
        setProgressMessage('Creating Ledger device connection')
        if (devices.length > 1) {
          return err(
            errorResponses[LedgerErrorResponse.MultipleLedgerConnected]
          )
        }

        return ok(undefined)
      })
      .andThen(() =>
        ResultAsync.fromPromise(
          transport.create(),
          () => LedgerErrorResponse.FailedToCreateTransport
        ).map((transport) => {
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
                return err(
                  isKnownError(statusCode)
                    ? errorResponses[statusCode]
                    : `Unknown error: ${statusCode}`
                )
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
    createLedgerTransport().andThen(({ closeTransport, exchange }) =>
      fn(exchange)
        .andThen((response) => closeTransport().map(() => response))
        .mapErr((error) => {
          closeTransport()
          return error
        })
    )

  const ensureCorrectDeviceId =
    (expectedDeviceId: string) => (ledgerDeviceId: string) => {
      setProgressMessage('Checking Ledger Device ID')

      return ledgerDeviceId === expectedDeviceId
        ? ok(undefined)
        : err(errorResponses[LedgerErrorResponse.DeviceMismatch])
    }

  const getOlympiaDeviceInfo = ({
    derivationPaths,
  }: Pick<LedgerImportOlympiaDeviceRequest, 'derivationPaths'>) =>
    wrapDataExchange((exchange) =>
      exchange(LedgerInstructionCode.GetDeviceId).andThen((id) =>
        exchange(LedgerInstructionCode.GetDeviceModel).andThen((model) =>
          derivationPaths
            .reduce(
              (
                acc: ResultAsync<{ publicKey: string; path: string }[], string>,
                path,
                index
              ) => {
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

  const getDeviceInfo = () =>
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
  ) =>
    wrapDataExchange((exchange) =>
      exchange(LedgerInstructionCode.GetDeviceId)
        .andThen(ensureCorrectDeviceId(params.ledgerDevice.id))
        .andThen(() => {
          const encodedDerivationPath = encodeDerivationPath(
            params.keyParameters.derivationPath
          )
          setProgressMessage('Getting public key...')

          return exchange(
            params.keyParameters.curve === 'curve25519'
              ? LedgerInstructionCode.GetPubKeyEd25519
              : LedgerInstructionCode.GetPubKeySecp256k1,
            encodedDerivationPath
          )
        })
    )

  const signTransaction = (
    params: Omit<
      LedgerSignTransactionRequest,
      'discriminator' | 'interactionId'
    >
  ) =>
    wrapDataExchange((exchange) =>
      exchange(LedgerInstructionCode.GetDeviceId)
        .andThen(ensureCorrectDeviceId(params.ledgerDevice.id))
        .andThen(() => {
          const compiledTxIntentChunksResult = bufferToChunks(
            Buffer.from(params.compiledTransactionIntent, 'hex'),
            255
          )
          if (compiledTxIntentChunksResult.isErr())
            return err('error chunking data')

          const apduChunks = compiledTxIntentChunksResult.value.map(
            (chunk, index) => ({
              chunk: chunk.toString('hex'),
              instructionClass:
                index === compiledTxIntentChunksResult.value.length - 1
                  ? LedgerInstructionClass.ac
                  : LedgerInstructionClass.ab,
            })
          )

          const p1 = params.displayHash ? '01' : '00'

          return params.signers.reduce(
            (
              signersAcc: ResultAsync<SignatureOfSigner[], string>,
              signer,
              index
            ) => {
              let command: LedgerInstructionCode =
                signer.curve === 'curve25519'
                  ? LedgerInstructionCode.SignTxEd255519
                  : LedgerInstructionCode.SignTxSecp256k1

              if (params.mode === 'summary') {
                command = String(Number(command) + 1) as LedgerInstructionCode
              }

              const encodedDerivationPath = encodeDerivationPath(
                signer.derivationPath
              )

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
                        acc.andThen(() => {
                          const chunkLength = getDataLength(chunk)

                          return exchange(command, `${chunkLength}${chunk}`, {
                            instructionClass,
                            p1,
                          })
                        }),
                      okAsync('')
                    )
                  )
                  .andThen((result) => {
                    const isCurve25519 = signer.curve === 'curve25519'
                    const signatureByteCount = isCurve25519 ? 64 : 65
                    const publicKeyByteCount = isCurve25519 ? 32 : 33
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
        })
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
