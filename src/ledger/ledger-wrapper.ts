import { err, ok, okAsync, ResultAsync } from 'neverthrow'
import {
  LedgerImportOlympiaDeviceRequest,
  LedgerPublicKeyRequest,
  LedgerSignTransactionRequest,
} from './schemas'
import TransportWebHID from '@ledgerhq/hw-transport-webhid'
import { logger } from 'utils/logger'
import { bufferToChunks } from 'utils/buffer-to-chunks'

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

const LedgerInstructionCode = {
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

export const encodeHdPath = (hdPath: string) => {
  const path = hdPath.split('H').join(`'`).slice(2).split('/')
  const length = `00${(path.length & 0xff).toString(16)}`.slice(-2)

  const parts = path
    .map((value) => 0x80000000 + parseInt(value, 10))
    .map((value) => value.toString(16))
    .join('')

  return `${length}${parts}`
}

export const getDataLength = (data: string) =>
  Math.floor(data.length / 2).toString(16)

const createLedgerTransport = () =>
  ResultAsync.fromPromise(
    TransportWebHID.list(),
    () => LedgerErrorResponse.FailedToCreateTransport
  )
    .andThen((devices) => {
      if (devices.length > 1) {
        return err(errorResponses[LedgerErrorResponse.MultipleLedgerConnected])
      }

      return ok(undefined)
    })
    .andThen(() =>
      ResultAsync.fromPromise(
        TransportWebHID.create(),
        () => errorResponses[LedgerErrorResponse.FailedToCreateTransport]
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
            logger.debug(`Ledger response to ${command}`, stringifiedResponse)
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
          closeTransport: () => ResultAsync.fromSafePromise(transport.close()),
          exchange,
        }
      })
    )

export const getOlympiaDeviceInfo = (
  params: LedgerImportOlympiaDeviceRequest
) =>
  createLedgerTransport().andThen(({ closeTransport, exchange }) =>
    exchange(LedgerInstructionCode.GetDeviceId)
      .andThen((id) =>
        exchange(LedgerInstructionCode.GetDeviceModel).andThen((model) =>
          params.derivationPaths
            .reduce(
              (
                acc: ResultAsync<{ publicKey: string; path: string }[], string>,
                path
              ) => {
                const bip32Data = encodeHdPath(path)
                const dataLength = getDataLength(bip32Data)

                return acc.andThen((publicKeys: any) =>
                  exchange(
                    LedgerInstructionCode.GetPubKeyEd25519,
                    `${dataLength}${bip32Data}`
                  ).map((publicKey) => [...publicKeys, { publicKey, path }])
                )
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

export const getDeviceInfo = () =>
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

export const getPublicKey = (params: LedgerPublicKeyRequest) =>
  createLedgerTransport().andThen(({ closeTransport, exchange }) =>
    exchange(LedgerInstructionCode.GetDeviceId)
      .andThen((deviceId) => {
        if (deviceId !== params.ledgerDevice.id) {
          return err(errorResponses[LedgerErrorResponse.DeviceMismatch])
        }
        const bip32Data = encodeHdPath(params.keyParameters.derivationPath)
        const dataLength = getDataLength(bip32Data)
        return exchange(
          params.keyParameters.curve === 'curve25519'
            ? LedgerInstructionCode.GetPubKeyEd25519
            : LedgerInstructionCode.GetPubKeySecp256k1,
          `${dataLength}${bip32Data}`
        )
      })
      .andThen((result) => closeTransport().map(() => result))
      .mapErr((error) => {
        closeTransport()
        return error
      })
  )

export const signTransaction = (params: LedgerSignTransactionRequest) => {
  let command: LedgerInstruction =
    params.keyParameters.curve === 'curve25519'
      ? LedgerInstructionCode.SignTxEd255519
      : LedgerInstructionCode.SignTxSecp256k1

  if (params.mode === 'summary') {
    command = String(Number(command) + 1) as LedgerInstruction
  }

  return createLedgerTransport().andThen(({ closeTransport, exchange }) =>
    exchange(LedgerInstructionCode.GetDeviceId)
      .andThen((deviceId) => {
        if (deviceId !== params.ledgerDevice.id) {
          return err(errorResponses[LedgerErrorResponse.DeviceMismatch])
        }

        const bip32Data = encodeHdPath(params.keyParameters.derivationPath)
        const dataLength = getDataLength(bip32Data)
        const data = bufferToChunks(
          Buffer.from(params.compiledTransactionIntent, 'hex'),
          255
        )
        if (data.isErr()) return err('error chunking data')

        const chunks = data.value.map((chunk, index) => ({
          chunk: chunk.toString('hex'),
          instructionClass:
            index === data.value.length - 1
              ? LedgerInstructionClass.ac
              : LedgerInstructionClass.ab,
        }))

        return exchange(command, `${dataLength}${bip32Data}`)
          .andThen(() =>
            chunks.reduce(
              (
                acc: ResultAsync<string[], string>,
                { chunk, instructionClass }
              ) =>
                acc.andThen((results) => {
                  const chunkLength = getDataLength(chunk)

                  return exchange(
                    command,
                    `${chunkLength}${chunk}`,
                    instructionClass
                  ).map((result) => [...results, result])
                }),
              okAsync([])
            )
          )
          .map((results) => results.filter((result) => result !== ''))
          .map((results) => results[0])
      })
      .andThen((result) => closeTransport().map(() => result))
      .mapErr((error) => {
        closeTransport()
        return error
      })
  )
}
