import { z, object, string, union, literal, number } from 'zod'

const Offer = literal('offer')
const Answer = literal('answer')
const Ice = literal('iceCandidate')

const Types = union([Offer, Answer, Ice])

export const AnswerIO = object({
  requestId: string(),
  method: Answer,
  source: union([literal('android'), literal('extension'), literal('iOS')]),
  connectionId: string(),
  encryptedPayload: string(),
  payload: object({
    sdp: string(),
  }),
  error: string().optional(),
})

export const OfferIO = object({
  requestId: string(),
  method: Offer,
  source: union([literal('android'), literal('extension'), literal('iOS')]),
  connectionId: string(),
  encryptedPayload: string(),
  payload: object({
    sdp: string(),
  }),
  error: string().optional(),
})

export const IceCandidateIO = object({
  requestId: string(),
  method: Ice,
  source: union([literal('android'), literal('extension'), literal('iOS')]),
  connectionId: string(),
  encryptedPayload: string(),
  payload: object({
    candidate: string(),
    sdpMid: string(),
    sdpMLineIndex: number(),
  }),
  error: string().optional(),
})

export type Answer = z.infer<typeof AnswerIO>
export type Offer = z.infer<typeof OfferIO>
export type IceCandidate = z.infer<typeof IceCandidateIO>
export type MessageTypes = z.infer<typeof Types>

export type DataTypes = Answer | IceCandidate | Offer
