import { SignalingServerResponse } from 'io-types/types'
import { parseJSON } from 'utils'

export const parseRawMessage = (data: string) =>
  parseJSON<SignalingServerResponse>(data)
