import { err, ok, okAsync, ResultAsync } from 'neverthrow'
import {
  LedgerImportOlympiaDeviceRequest,
  LedgerPublicKeyRequest,
  LedgerSignTransactionRequest,
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
}

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
type LedgerInstruction = Values<typeof LedgerInstructionCode>

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
  onProgressSubject: new Subject<{ message: string } | undefined>(),
})

export type LedgerOptions = {
  transport: typeof TransportWebHID
  ledgerSubjects?: ReturnType<typeof LedgerSubjects>
}

export const LedgerWrapper = ({ transport, ledgerSubjects }: LedgerOptions) => {
  const { onProgressSubject } = ledgerSubjects || LedgerSubjects()

  const sendProgressMessage = (message?: string) =>
    onProgressSubject.next(message ? { message } : undefined)

  const createLedgerTransport = () =>
    ResultAsync.fromPromise(
      transport.list(),
      () => LedgerErrorResponse.FailedToCreateTransport
    )
      .andThen((devices) => {
        sendProgressMessage('Checking Ledger device connection')
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
            command: LedgerInstruction,
            data = '',
            instructionClass = LedgerInstructionClass.aa
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
              sendProgressMessage(undefined)
              return ResultAsync.fromSafePromise(transport.close())
            },
            exchange,
          }
        })
      )

  const getOlympiaDeviceInfo = ({
    derivationPaths,
  }: Pick<LedgerImportOlympiaDeviceRequest, 'derivationPaths'>) =>
    createLedgerTransport().andThen(({ closeTransport, exchange }) =>
      exchange(LedgerInstructionCode.GetDeviceId)
        .andThen((id) =>
          exchange(LedgerInstructionCode.GetDeviceModel).andThen((model) =>
            derivationPaths
              .reduce(
                (
                  acc: ResultAsync<
                    { publicKey: string; path: string }[],
                    string
                  >,
                  path,
                  index
                ) => {
                  const encodedDerivationPath = encodeDerivationPath(path)

                  return acc.andThen((publicKeys: any) => {
                    sendProgressMessage(
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
        .andThen((result) => closeTransport().map(() => result))
        .mapErr((error) => {
          closeTransport()
          return error
        })
    )

  const getDeviceInfo = () =>
    createLedgerTransport().andThen(({ closeTransport, exchange }) =>
      exchange(LedgerInstructionCode.GetDeviceId)
        .andThen((deviceId) =>
          exchange(LedgerInstructionCode.GetDeviceModel).map((model) => ({
            deviceId,
            model,
          }))
        )
        .andThen((result) => closeTransport().map(() => result))
        .mapErr((error) => {
          closeTransport()
          return error
        })
    )

  const getPublicKey = (
    params: Omit<LedgerPublicKeyRequest, 'discriminator' | 'interactionId'>
  ) =>
    createLedgerTransport().andThen(({ closeTransport, exchange }) =>
      exchange(LedgerInstructionCode.GetDeviceId)
        .andThen((deviceId) => {
          sendProgressMessage('Comparing Ledger Device ID')
          if (deviceId !== params.ledgerDevice.id) {
            return err(errorResponses[LedgerErrorResponse.DeviceMismatch])
          }
          const encodedDerivationPath = encodeDerivationPath(
            params.keyParameters.derivationPath
          )

          return exchange(
            params.keyParameters.curve === 'curve25519'
              ? LedgerInstructionCode.GetPubKeyEd25519
              : LedgerInstructionCode.GetPubKeySecp256k1,
            encodedDerivationPath
          )
        })
        .andThen((result) => closeTransport().map(() => result))
        .mapErr((error) => {
          closeTransport()
          return error
        })
    )

  const signTransaction = (
    params: Omit<
      LedgerSignTransactionRequest,
      'discriminator' | 'interactionId'
    >
  ) =>
    createLedgerTransport().andThen(({ closeTransport, exchange }) =>
      exchange(LedgerInstructionCode.GetDeviceId)
        .andThen((deviceId) => {
          if (deviceId !== params.ledgerDevice.id) {
            return err(errorResponses[LedgerErrorResponse.DeviceMismatch])
          }

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
            (signersAcc: ResultAsync<any[], string>, signer, index) => {
              let command: LedgerInstruction =
                signer.curve === 'curve25519'
                  ? LedgerInstructionCode.SignTxEd255519
                  : LedgerInstructionCode.SignTxSecp256k1

              if (params.mode === 'summary') {
                command = String(Number(command) + 1) as LedgerInstruction
              }

              const encodedDerivationPath = encodeDerivationPath(
                signer.derivationPath
              )

              return signersAcc.andThen((previousValue) => {
                sendProgressMessage(
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
        .andThen((result) => closeTransport().map(() => result))
        .mapErr((error) => {
          closeTransport()
          return error
        })
    )

  return {
    progress$: onProgressSubject.asObservable(),
    getOlympiaDeviceInfo,
    getDeviceInfo,
    getPublicKey,
    signTransaction,
  }
}

export const ledger = LedgerWrapper({ transport: TransportWebHID })
