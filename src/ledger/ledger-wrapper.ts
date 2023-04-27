import { err, ok, okAsync, ResultAsync } from 'neverthrow'
import {
  LedgerImportOlympiaDeviceRequest,
  LedgerPublicKeyRequest,
  LedgerSignTransactionRequest,
  SignatureOfSigner,
} from './schemas'
import TransportWebHID from '@ledgerhq/hw-transport-webhid'
import { logger } from 'utils/logger'
import { bufferToChunks } from 'utils/buffer-to-chunks'
import { Subject } from 'rxjs'

type Values<T> = T[keyof T]

const LedgerInstructionClass = {
  aa: 'aa',
  ab: 'ab',
  ac: 'ac',
} as const

const LedgerErrorResponse = {
  FailedToCreateTransport: 'FailedToCreateTransport',
  FailedToExchangeData: 'FailedToExchangeData',
  MultipleLedgerConnected: 'MultipleLedgerConnected',
  DeviceMismatch: 'DeviceMismatch',
  UnlockDevice: '5515',
  OpenRadixApp: '6e01',
} as const

export const LedgerInstructionCode = {
  GetDeviceModel: '11',
  GetDeviceId: '12',
  GetPubKeyEd25519: '21',
  GetPubKeySecp256k1: '31',
  SignTxEd255519: '41',
  SignTxEd255519Smart: '42',
  SignTxSecp256k1: '51',
  SignTxSecp256k1Smart: '52',
} as const

type LedgerError = Values<typeof LedgerErrorResponse>
type LedgerInstructionCode = Values<typeof LedgerInstructionCode>
type LedgerInstructionClass = Values<typeof LedgerInstructionClass>

const isKnownError = (statusCode: any): statusCode is LedgerError =>
  Object.values(LedgerErrorResponse).includes(statusCode)

const errorResponses: Record<LedgerError, string> = {
  [LedgerErrorResponse.MultipleLedgerConnected]:
    'Please connect only one ledger device',
  [LedgerErrorResponse.UnlockDevice]:
    'Please unlock Ledger Device and try again',
  [LedgerErrorResponse.OpenRadixApp]:
    'Please open Radix Babylon app in your Ledger device and try again',
  [LedgerErrorResponse.FailedToCreateTransport]:
    'Failed to open transport layer with Ledger device',
  [LedgerErrorResponse.FailedToExchangeData]:
    'Failed to exchange data with Ledger device',
  [LedgerErrorResponse.DeviceMismatch]: `Device doesn't match. Make sure you connected correct Ledger device`,
}

export const getDataLength = (data: string) =>
  Math.floor(data.length / 2).toString(16)

export const encodeDerivationPath = (derivationPath: string) => {
  const path = derivationPath.split('H').join(`'`).slice(2).split('/')
  const length = `00${(path.length & 0xff).toString(16)}`.slice(-2)

  const parts = path
    .map(
      (value) => (value.endsWith("'") ? 0x80000000 : 0) + parseInt(value, 10)
    )
    .map((value) => value.toString(16).padStart(8, '0'))
    .join('')

  const data = `${length}${parts}`
  const dataLength = getDataLength(data)

  return `${dataLength}${data}`
}

const LedgerSubjects = () => ({
  onProgressSubject: new Subject<string>(),
})

export type LedgerOptions = Partial<{
  transport: typeof TransportWebHID
  ledgerSubjects: ReturnType<typeof LedgerSubjects>
}>

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
          const exchange = (
            command: LedgerInstructionCode,
            data = '',
            instructionClass: LedgerInstructionClass = LedgerInstructionClass.aa
          ) =>
            ResultAsync.fromPromise(
              transport.exchange(
                Buffer.from(`${instructionClass}${command}0000${data}`, 'hex')
              ),
              () => errorResponses[LedgerErrorResponse.FailedToExchangeData]
            ).andThen((buffer) => {
              const stringifiedResponse = buffer.toString('hex')
              logger.debug(`📒 Ledger`, {
                input: `${instructionClass}${command}0000${data}`,
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
    fn: (
      exchangeFn: (
        command: LedgerInstructionCode,
        data?: string,
        instructionClass?: LedgerInstructionClass
      ) => ResultAsync<string, string>
    ) => ResultAsync<any, any>
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
                return exchange(command, encodedDerivationPath)
                  .andThen(() =>
                    apduChunks.reduce(
                      (
                        acc: ResultAsync<string, string>,
                        { chunk, instructionClass }
                      ) =>
                        acc.andThen(() => {
                          const chunkLength = getDataLength(chunk)

                          return exchange(
                            command,
                            `${chunkLength}${chunk}`,
                            instructionClass
                          )
                        }),
                      okAsync('')
                    )
                  )
                  .map((result) => ({
                    publicKey: result.slice(128),
                    signature: result.slice(0, 128),
                  }))
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
