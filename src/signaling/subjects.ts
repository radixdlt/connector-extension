import {
  Confirmation,
  MessageSources,
  SignalingServerErrorResponse,
} from 'io-types/types'
import { Result } from 'neverthrow'
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs'
import { Secrets } from './secrets'
import { Buffer } from 'buffer'

export type Status =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'disconnecting'

export type SignalingSubjectsType = ReturnType<typeof SignalingSubjects>
export const SignalingSubjects = () => ({
  wsOfferReceivedSubject: new BehaviorSubject<boolean>(false),
  wsSourceSubject: new ReplaySubject<MessageSources>(),
  wsOutgoingMessageSubject: new Subject<string>(),
  wsIncomingRawMessageSubject: new Subject<MessageEvent<string>>(),
  wsErrorSubject: new Subject<Event>(),
  wsStatusSubject: new BehaviorSubject<Status>('disconnected'),
  wsConnectSubject: new BehaviorSubject<boolean>(false),
  wsConnectionPasswordSubject: new BehaviorSubject<Buffer | undefined>(
    undefined
  ),
  wsConnectionSecretsSubject: new BehaviorSubject<
    Result<Secrets, Error> | undefined
  >(undefined),
  wsGenerateConnectionSecretsSubject: new Subject<void>(),
  wsIncomingMessageConfirmationSubject: new Subject<Confirmation>(),
  wsServerErrorResponseSubject: new Subject<SignalingServerErrorResponse>(),
  wsIsSendingMessageSubject: new BehaviorSubject<boolean>(false),
  wsAutoConnect: new BehaviorSubject<boolean>(false),
  wsLoadOrCreateConnectionPasswordSubject: new Subject<void>(),
  wsRegenerateConnectionPassword: new Subject<void>(),
})
