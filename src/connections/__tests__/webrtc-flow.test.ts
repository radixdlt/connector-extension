import log from 'loglevel'
import { Status, DataChannelStatus } from 'connections'
import { filter, firstValueFrom, Observable } from 'rxjs'
import { subscribeSpyTo } from '@hirez_io/observer-spy'
import { config } from '../../config'
import { WebRtcClient } from 'connections/webrtc-client'
import { delayAsync } from 'test-utils/delay-async'

const waitUntilStatus = async (status: Status, obs: Observable<Status>) =>
  firstValueFrom(obs.pipe(filter((s) => s === status)))

const waitUntilOpen = async (
  status: DataChannelStatus,
  obs: Observable<DataChannelStatus>
) => firstValueFrom(obs.pipe(filter((s) => s === status)))

const WebRtcTestHelper = {
  bootstrap: async (client: WebRtcClient) => {
    client.subjects.wsConnectionPasswordSubject.next(
      Buffer.from([146, 116, 216, 80, 168])
    )
    client.subjects.wsConnectSubject.next(true)

    await waitUntilStatus('connected', client.subjects.wsStatusSubject)
  },

  cleanup: async (client: WebRtcClient) => {
    client.destroy()
    await waitUntilStatus('disconnected', client.subjects.wsStatusSubject)
    await waitUntilOpen('closed', client.subjects.rtcStatusSubject)
  },
}

let walletClient: WebRtcClient
let extensionClient: WebRtcClient

describe('webRTC flow', () => {
  beforeEach(async () => {
    log.setLevel('silent')
    walletClient = WebRtcClient({
      signalingServerOptions: {
        ...config.signalingServer,
        target: 'extension',
        source: 'wallet',
      },
      webRtcOptions: config.webRTC,
    })

    extensionClient = WebRtcClient({
      signalingServerOptions: config.signalingServer,
      webRtcOptions: config.webRTC,
    })

    await WebRtcTestHelper.bootstrap(walletClient)
    await WebRtcTestHelper.bootstrap(extensionClient)

    log.setLevel('debug')
  })

  afterEach(async () => {
    log.setLevel('debug')
    await WebRtcTestHelper.cleanup(walletClient)
    await WebRtcTestHelper.cleanup(extensionClient)
  })

  it('should send message over data channel between two clients', async () => {
    walletClient.subjects.rtcConnectSubject.next(true)
    extensionClient.subjects.rtcConnectSubject.next(true)

    walletClient.subjects.rtcCreateOfferSubject.next()

    await waitUntilOpen('open', walletClient.subjects.rtcStatusSubject)
    await waitUntilOpen('open', extensionClient.subjects.rtcStatusSubject)

    const walletIncomingMessage = subscribeSpyTo(
      walletClient.subjects.rtcIncomingMessageSubject
    )
    const extensionIncomingMessage = subscribeSpyTo(
      extensionClient.subjects.rtcIncomingMessageSubject
    )

    walletClient.subjects.rtcOutgoingMessageSubject.next('hello from wallet')
    extensionClient.subjects.rtcOutgoingMessageSubject.next(
      'hello from extension'
    )

    await waitUntilStatus('disconnected', walletClient.subjects.wsStatusSubject)
    await waitUntilStatus(
      'disconnected',
      extensionClient.subjects.wsStatusSubject
    )
    await delayAsync()

    expect(extensionIncomingMessage.getValues()).toEqual([
      { data: 'hello from wallet', type: 'message' },
    ])
    expect(walletIncomingMessage.getValues()).toEqual([
      { data: 'hello from extension', type: 'message' },
    ])
  })
})
