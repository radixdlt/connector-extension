import { BehaviorSubject, Subject } from 'rxjs'
import { ChunkedMessageType, Message } from './_types'

export type ConnectorClientSubjects = ReturnType<typeof ConnectorClientSubjects>

export const ConnectorClientSubjects = () => ({
  shouldConnectSubject: new BehaviorSubject<boolean>(false),
  connected: new BehaviorSubject<boolean>(false),
  triggerRestartSubject: new Subject<void>(),
  onDataChannelMessageSubject: new Subject<ChunkedMessageType>(),
  onMessage: new Subject<Message>(),
  sendMessageOverDataChannelSubject: new Subject<string>(),
})
