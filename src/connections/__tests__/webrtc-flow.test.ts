import log from 'loglevel'
import { Status, DataChannelStatus } from 'connections'
import { filter, firstValueFrom, Observable } from 'rxjs'
import { subscribeSpyTo } from '@hirez_io/observer-spy'
import { config } from '../../config'
import { WebRtcClient } from 'connections/webrtc-client'
import { delayAsync } from 'test-utils/delay-async'

const oneMB = new Array(1000)
  .fill(null)
  .map(
    () =>
      `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean eu odio consectetur, varius lorem quis, finibus enim. Aliquam erat volutpat. Vivamus posuere sit amet justo ut vulputate. Nam ultrices nec tortor at pulvinar. Nunc et nibh purus. Donec vehicula venenatis risus eu sollicitudin. Sed posuere eu odio ac semper. Sed vitae est id dui blandit aliquet. Sed dapibus mi dui, ut rhoncus dolor aliquet tempus. Nam fermentum justo a arcu egestas, id laoreet urna condimentum. Nunc auctor elit sed arcu lobortis, a tincidunt libero mollis. Etiam hendrerit eu risus eget porttitor. Donec vitae neque vehicula, cursus magna eget, mollis metus. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Vestibulum vel facilisis diam. Sed non tortor ultricies, viverra mauris tempor, cursus justo. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Vestibulum vel facilisis diam. Sed non tortor ultricies, viverra mauris tempor, cursu. `
  )
  .join('')

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
    client.subjects.rtcConnectSubject.next(false)
    await waitUntilOpen('closed', client.subjects.rtcStatusSubject)
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
    log.setLevel('silent')
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

    const message = oneMB.slice(0, oneMB.length / 1000)

    walletClient.subjects.rtcOutgoingMessageSubject.next(message)
    extensionClient.subjects.rtcOutgoingMessageSubject.next(
      'hello from extension'
    )

    await waitUntilStatus('disconnected', walletClient.subjects.wsStatusSubject)
    await waitUntilStatus(
      'disconnected',
      extensionClient.subjects.wsStatusSubject
    )
    await delayAsync()

    expect(extensionIncomingMessage.getValues()).toEqual([message])
    expect(walletIncomingMessage.getValues()).toEqual(['hello from extension'])
  })

  it.skip('should reconnect if a client disconnects', async () => {
    walletClient.subjects.rtcConnectSubject.next(true)
    extensionClient.subjects.rtcConnectSubject.next(true)

    walletClient.subjects.rtcCreateOfferSubject.next()

    await waitUntilOpen('open', walletClient.subjects.rtcStatusSubject)
    await waitUntilOpen('open', extensionClient.subjects.rtcStatusSubject)

    await waitUntilStatus('disconnected', walletClient.subjects.wsStatusSubject)
    await waitUntilStatus(
      'disconnected',
      extensionClient.subjects.wsStatusSubject
    )

    // extensionClient.webRtc.peerConnection?.dataChannel.close()

    await delayAsync()
  })
})
