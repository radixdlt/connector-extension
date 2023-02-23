import { Status } from 'connector/_types'
import { SignalingServerResponse } from 'io-types/types'
import { BehaviorSubject, Subject } from 'rxjs'

export type SignalingSubjectsType = ReturnType<typeof SignalingSubjects>
export const SignalingSubjects = () => ({
  onMessageSubject: new Subject<SignalingServerResponse>(),
  onErrorSubject: new Subject<Event>(),
  statusSubject: new BehaviorSubject<Status>('disconnected'),
  targetClientIdSubject: new BehaviorSubject<string | undefined>(undefined),
})
