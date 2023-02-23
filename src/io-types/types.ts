import { z, object, string, union, literal, number, ZodError, array } from 'zod'

const Offer = literal('offer')
const Answer = literal('answer')
const IceCandidate = literal('iceCandidate')
const IceCandidates = literal('iceCandidates')

const Types = union([Offer, Answer, IceCandidate, IceCandidates])

export const Sources = union([literal('wallet'), literal('extension')])

export const SignalingServerMessage = object({
  requestId: string(),
  targetClientId: string(),
  encryptedPayload: string(),
  source: Sources.optional(), // redundant, to be removed 
  connectionId: string().optional(), // redundant, to be removed
})

export const AnswerIO = SignalingServerMessage.extend({
  method: Answer,
  payload: object({
    sdp: string(),
  }),
})

export const OfferIO = SignalingServerMessage.extend({
  method: Offer,
  payload: object({
    sdp: string(),
  }),
})

const IceCandidatePayloadIO = object({
  candidate: string(),
  sdpMid: string(),
  sdpMLineIndex: number(),
})

export const IceCandidateIO = SignalingServerMessage.extend({
  method: IceCandidate,
  payload: IceCandidatePayloadIO,
})

export const IceCandidatesIO = SignalingServerMessage.extend({
  method: IceCandidates,
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

export type RemoteData<T extends DataTypes = DataTypes> = {
  info: 'remoteData'
  remoteClientId: string
  requestId: T['requestId']
  data: T
}

export type RemoteClientDisconnected = {
  info: 'remoteClientDisconnected'
  remoteClientId: string
}

export type RemoteClientJustConnected = {
  info: 'remoteClientJustConnected'
  remoteClientId: string
}

export type RemoteClientIsAlreadyConnected = {
  info: 'remoteClientIsAlreadyConnected'
  remoteClientId: string
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
