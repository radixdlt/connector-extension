import { config } from 'config'
import { signalingServerClient } from 'connections/signaling-server-client'
import log from 'loglevel'
import {
  Status,
  Subjects,
  WebRTC,
  messageHandler,
  DataChannelStatus,
} from 'connections'
import { filter, firstValueFrom, Observable } from 'rxjs'
import { subscribeSpyTo } from '@hirez_io/observer-spy'
import { delayAsync } from 'test-utils/delay-async'

type CreatePeerConnectionAndDataChannel = ReturnType<
  ReturnType<typeof WebRTC>['createPeerConnectionAndDataChannel']
>
type SignalingServerClient = ReturnType<typeof signalingServerClient>
type SubjectsType = ReturnType<typeof Subjects>
type MessageHandler = ReturnType<typeof messageHandler>

let extension: CreatePeerConnectionAndDataChannel
let wallet: CreatePeerConnectionAndDataChannel
let extensionSignalingServerClient: SignalingServerClient
let walletSignalingServerClient: SignalingServerClient
let extensionSubjects: SubjectsType
let walletSubjects: SubjectsType
let extensionMessageHandler: MessageHandler
let walletMessageHandler: MessageHandler

const password = Buffer.from([146, 116, 216, 80, 168])

const waitUntilStatus = async (status: Status, obs: Observable<Status>) =>
  firstValueFrom(obs.pipe(filter((s) => s === status)))

const waitUntilOpen = async (
  status: DataChannelStatus,
  obs: Observable<DataChannelStatus>
) => firstValueFrom(obs.pipe(filter((s) => s === status)))

const bootstrap = async () => {
  extensionSubjects = Subjects()
  walletSubjects = Subjects()

  extensionMessageHandler = messageHandler(extensionSubjects)
  walletMessageHandler = messageHandler(walletSubjects)

  extensionSubjects.wsConnectionPasswordSubject.next(password)
  walletSubjects.wsConnectionPasswordSubject.next(password)

  extensionSubjects.wsConnectSubject.next(true)
  walletSubjects.wsConnectSubject.next(true)

  extensionSignalingServerClient = signalingServerClient({
    url: config.signalingServer.baseUrl,
    subjects: extensionSubjects,
  })

  walletSignalingServerClient = signalingServerClient({
    url: config.signalingServer.baseUrl,
    subjects: walletSubjects,
    source: 'wallet',
    target: 'extension',
  })

  const extensionWebRTC = WebRTC({
    peerConnectionConfig: config.webRTC.peerConnectionConfig,
    dataChannelConfig: config.webRTC.dataChannelConfig,
    subjects: extensionSubjects,
  })

  const walletWebRTC = WebRTC({
    peerConnectionConfig: config.webRTC.peerConnectionConfig,
    dataChannelConfig: config.webRTC.dataChannelConfig,
    subjects: walletSubjects,
  })

  await waitUntilStatus('connected', extensionSubjects.wsStatusSubject)
  await waitUntilStatus('connected', walletSubjects.wsStatusSubject)

  extension = extensionWebRTC.createPeerConnectionAndDataChannel()
  wallet = walletWebRTC.createPeerConnectionAndDataChannel()
}

const cleanup = async () => {
  extensionSubjects.wsConnectSubject.next(false)
  walletSubjects.wsConnectSubject.next(false)
  await waitUntilStatus('disconnected', extensionSubjects.wsStatusSubject)
  await waitUntilStatus('disconnected', walletSubjects.wsStatusSubject)
  extension.destroy()
  wallet.destroy()
  extensionMessageHandler.subscriptions.unsubscribe()
  walletMessageHandler.subscriptions.unsubscribe()
  await waitUntilOpen('closed', walletSubjects.rtcStatusSubject)
  await waitUntilOpen('closed', extensionSubjects.rtcStatusSubject)
}

describe('webRTC flow', () => {
  beforeEach(async () => {
    log.setLevel('silent')
    await bootstrap()
    log.setLevel('debug')
  })

  afterEach(async () => {
    log.setLevel('silent')
    await cleanup()
  })

  it('should send message over data channel between two clients', async () => {
    walletSubjects.rtcCreateOfferSubject.next()

    await waitUntilOpen('open', walletSubjects.rtcStatusSubject)
    await waitUntilOpen('open', extensionSubjects.rtcStatusSubject)

    const walletIncomingMessage = subscribeSpyTo(
      walletSubjects.rtcIncomingMessageSubject
    )
    const extensionIncomingMessage = subscribeSpyTo(
      extensionSubjects.rtcIncomingMessageSubject
    )

    walletSubjects.rtcOutgoingMessageSubject.next('hello from wallet')
    extensionSubjects.rtcOutgoingMessageSubject.next('hello from extension')

    await delayAsync()

    expect(extensionIncomingMessage.getValues()).toEqual([
      { data: 'hello from wallet', type: 'message' },
    ])
    expect(walletIncomingMessage.getValues()).toEqual([
      { data: 'hello from extension', type: 'message' },
    ])
  })
})
