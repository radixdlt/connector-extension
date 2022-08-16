import { z, object, string, union, literal, number, ZodError } from 'zod'

const Offer = literal('offer')
const Answer = literal('answer')
const Ice = literal('iceCandidate')

const Types = union([Offer, Answer, Ice])

const Sources = union([literal('wallet'), literal('extension')])

export const AnswerIO = object({
  requestId: string(),
  method: Answer,
  source: Sources,
  connectionId: string(),
  encryptedPayload: string(),
  payload: object({
    sdp: string(),
  }),
})

export const OfferIO = object({
  requestId: string(),
  method: Offer,
  source: Sources,
  connectionId: string(),
  encryptedPayload: string(),
  payload: object({
    sdp: string(),
  }),
})

export const IceCandidateIO = object({
  requestId: string(),
  method: Ice,
  source: Sources,
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
export type MessageSources = z.infer<typeof Sources>

export type DataTypes = Answer | IceCandidate | Offer

export type Confirmation = {
  info: 'confirmation'
  requestId: DataTypes['requestId']
}

export type RemoteData = {
  info: 'remoteData'
  requestId: DataTypes['requestId']
  data: DataTypes
}

export type RemoteClientDisconnected = {
  info: 'remoteClientDisconnected'
}

export type RemoteClientJustConnected = {
  info: 'remoteClientJustConnected'
}

export type RemoteClientIsAlreadyConnected = {
  info: 'remoteClientIsAlreadyConnected'
}

export type MissingRemoteClientError = {
  info: 'missingRemoteClientError'
  requestId: DataTypes['requestId']
}

export type InvalidMessageError = {
  info: 'invalidMessageError'
  error: string
  data: string
}

export type ValidationError = {
  info: 'validationError'
  requestId: DataTypes['requestId']
  error: ZodError[]
}

export type SignalingServerResponse =
  | Confirmation
  | RemoteData
  | RemoteClientJustConnected
  | RemoteClientIsAlreadyConnected
  | RemoteClientDisconnected
  | MissingRemoteClientError
  | InvalidMessageError
  | ValidationError

export type SignalingServerErrorResponse =
  | RemoteClientDisconnected
  | MissingRemoteClientError
  | InvalidMessageError
  | ValidationError
