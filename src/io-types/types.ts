import { z, object, string, union, literal, number, ZodError } from 'zod'

const Offer = literal('offer')
const Answer = literal('answer')
const Ice = literal('iceCandidate')

const Types = union([Offer, Answer, Ice])

const source = union([literal('wallet'), literal('extension')])

export const AnswerIO = object({
  requestId: string(),
  method: Answer,
  source,
  connectionId: string(),
  encryptedPayload: string(),
  payload: object({
    sdp: string(),
  }),
})

export const OfferIO = object({
  requestId: string(),
  method: Offer,
  source,
  connectionId: string(),
  encryptedPayload: string(),
  payload: object({
    sdp: string(),
  }),
})

export const IceCandidateIO = object({
  requestId: string(),
  method: Ice,
  source,
  connectionId: string(),
  encryptedPayload: string(),
  payload: object({
    candidate: string(),
    sdpMid: string(),
    sdpMLineIndex: number(),
  }),
})

export type Answer = z.infer<typeof AnswerIO>
export type Offer = z.infer<typeof OfferIO>
export type IceCandidate = z.infer<typeof IceCandidateIO>
export type MessagePayloadTypes = z.infer<typeof Types>

export type DataTypes = Answer | IceCandidate | Offer

export type Confirmation = {
  info: 'Confirmation'
  requestId: DataTypes['requestId']
}

export type RemoteData = {
  info: 'RemoteData'
  requestId: DataTypes['requestId']
  data: DataTypes
}

export type RemoteClientDisconnected = {
  info: 'RemoteClientDisconnected'
  target: DataTypes['source']
}

export type MissingRemoteClientError = {
  info: 'MissingRemoteClientError'
  requestId: DataTypes['requestId']
}

export type InvalidMessageError = {
  info: 'InvalidMessageError'
  error: string
  data: string
}

export type ValidationError = {
  info: 'ValidationError'
  requestId: DataTypes['requestId']
  error: ZodError[]
}

export type SignalingServerResponse =
  | Confirmation
  | RemoteData
  | RemoteClientDisconnected
  | MissingRemoteClientError
  | InvalidMessageError
  | ValidationError

export type SignalingServerErrorResponse =
  | RemoteClientDisconnected
  | MissingRemoteClientError
  | InvalidMessageError
  | ValidationError
