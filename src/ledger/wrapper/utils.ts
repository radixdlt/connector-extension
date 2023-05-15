import { LedgerError, LedgerErrorResponse } from './constants'

export const isKnownError = (statusCode: any): statusCode is LedgerError =>
  Object.values(LedgerErrorResponse).includes(statusCode)

export const getDataLength = (data: string) =>
  Math.floor(data.length / 2).toString(16)
