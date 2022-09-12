import { z, object, string, union, literal, number, ZodError, array } from 'zod'

const Offer = literal('offer')
const Answer = literal('answer')
const IceCandidate = literal('iceCandidate')
const IceCandidates = literal('iceCandidates')

const Types = union([Offer, Answer, IceCandidate, IceCandidates])

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

const IceCandidatePayloadIO = object({
  candidate: string(),
  sdpMid: string(),
  sdpMLineIndex: number(),
})

export const IceCandidateIO = object({
  requestId: string(),
  method: IceCandidate,
  source: Sources,
  connectionId: string(),
  encryptedPayload: string(),
  payload: IceCandidatePayloadIO,
})

export const IceCandidatesIO = object({
  requestId: string(),
  method: IceCandidates,
  source: Sources,
  connectionId: string(),
  encryptedPayload: string(),
  payload: array(IceCandidatePayloadIO),
})

export type Answer = z.infer<typeof AnswerIO>
export type Offer = z.infer<typeof OfferIO>
export type IceCandidate = z.infer<typeof IceCandidateIO>
export type IceCandidates = z.infer<typeof IceCandidatesIO>
export type MessagePayloadTypes = z.infer<typeof Types>
export type MessageSources = z.infer<typeof Sources>

export type DataTypes = Answer | IceCandidate | Offer | IceCandidates

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
