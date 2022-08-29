import log from 'loglevel'
import { Status } from 'connections'
import { filter, firstValueFrom, Observable } from 'rxjs'
import { subscribeSpyTo } from '@hirez_io/observer-spy'
import { config } from '../../config'
import { WebRtcClient } from 'connections/webrtc-client'
import { delayAsync } from 'test-utils/delay-async'
import {
  BootstrapApplication,
  BootstrapApplicationType,
} from '../../bootstrap-application'

const oneMB = new Array(1000)
  .fill(null)
  .map(
    () =>
      `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean eu odio consectetur, varius lorem quis, finibus enim. Aliquam erat volutpat. Vivamus posuere sit amet justo ut vulputate. Nam ultrices nec tortor at pulvinar. Nunc et nibh purus. Donec vehicula venenatis risus eu sollicitudin. Sed posuere eu odio ac semper. Sed vitae est id dui blandit aliquet. Sed dapibus mi dui, ut rhoncus dolor aliquet tempus. Nam fermentum justo a arcu egestas, id laoreet urna condimentum. Nunc auctor elit sed arcu lobortis, a tincidunt libero mollis. Etiam hendrerit eu risus eget porttitor. Donec vitae neque vehicula, cursus magna eget, mollis metus. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Vestibulum vel facilisis diam. Sed non tortor ultricies, viverra mauris tempor, cursus justo. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Vestibulum vel facilisis diam. Sed non tortor ultricies, viverra mauris tempor, cursu. `
  )
  .join('')

const waitUntilStatus = async (status: Status, obs: Observable<Status>) =>
  firstValueFrom(obs.pipe(filter((s) => s === status)))

const waitUntilOpen = async (status: Status, obs: Observable<Status>) =>
  firstValueFrom(obs.pipe(filter((s) => s === status)))

const WebRtcTestHelper = {
  bootstrap: async (client: WebRtcClient) => {
    client.subjects.wsConnectionPasswordSubject.next(
      Buffer.from([
        101, 11, 188, 67, 254, 113, 165, 152, 53, 19, 118, 227, 195, 21, 110,
        83, 145, 197, 78, 134, 31, 238, 50, 160, 207, 34, 245, 16, 26, 135, 105,
        96,
      ])
    )
    client.subjects.wsConnectSubject.next(true)

    await waitUntilStatus('connected', client.subjects.wsStatusSubject)
  },

  cleanup: async (client: WebRtcClient) => {
    client.subjects.rtcConnectSubject.next(false)
    await waitUntilOpen('disconnected', client.subjects.rtcStatusSubject)
    client.destroy()
    await waitUntilStatus('disconnected', client.subjects.wsStatusSubject)
    await waitUntilOpen('disconnected', client.subjects.rtcStatusSubject)
  },
}

let wallet: BootstrapApplicationType
let extension: BootstrapApplicationType

describe('webRTC flow', () => {
  beforeEach(async () => {
    log.setLevel('silent')
    extension = BootstrapApplication({})

    wallet = BootstrapApplication({
      webRtcClientOptions: {
        webRtcOptions: config.webRTC,
      },
      signalingServerOptions: {
        ...config.signalingServer,
        source: 'wallet',
        target: 'extension',
      },
    })

    await WebRtcTestHelper.bootstrap(wallet.webRtcClient)
    await WebRtcTestHelper.bootstrap(extension.webRtcClient)
  })

  afterEach(async () => {
    log.setLevel('silent')
    wallet.destroy()
    extension.destroy()
  })

  it('should send message over data channel between two clients', async () => {
    log.setLevel('silent')
    wallet.webRtcClient.subjects.rtcConnectSubject.next(true)
    extension.webRtcClient.subjects.rtcConnectSubject.next(true)

    wallet.webRtcClient.subjects.rtcCreateOfferSubject.next()

    await waitUntilOpen(
      'connected',
      wallet.webRtcClient.subjects.rtcStatusSubject
    )
    await waitUntilOpen(
      'connected',
      extension.webRtcClient.subjects.rtcStatusSubject
    )

    const walletIncomingMessage = subscribeSpyTo(
      wallet.webRtcClient.subjects.rtcIncomingMessageSubject
    )
    const extensionIncomingMessage = subscribeSpyTo(
      extension.webRtcClient.subjects.rtcIncomingMessageSubject
    )

    const message = oneMB.slice(0, oneMB.length / 1000)

    await waitUntilStatus(
      'disconnected',
      wallet.webRtcClient.subjects.wsStatusSubject
    )
    await waitUntilStatus(
      'disconnected',
      extension.webRtcClient.subjects.wsStatusSubject
    )

    wallet.messageClient.subjects.addMessageSubject.next(message)
    extension.messageClient.subjects.addMessageSubject.next(
      'hello from extension'
    )

    await delayAsync()

    expect(extensionIncomingMessage.getValues()).toEqual([
      JSON.stringify(message),
    ])
    expect(walletIncomingMessage.getValues()).toEqual([
      JSON.stringify('hello from extension'),
    ])
  }, 30_000)

  it('should reconnect if a client disconnects', async () => {
    log.setLevel('silent')
    wallet.webRtcClient.subjects.rtcConnectSubject.next(true)
    extension.webRtcClient.subjects.rtcConnectSubject.next(true)

    wallet.webRtcClient.subjects.rtcCreateOfferSubject.next()
    await waitUntilOpen(
      'connected',
      wallet.webRtcClient.subjects.rtcStatusSubject
    )
    await waitUntilOpen(
      'connected',
      extension.webRtcClient.subjects.rtcStatusSubject
    )

    await waitUntilStatus(
      'disconnected',
      wallet.webRtcClient.subjects.wsStatusSubject
    )
    await waitUntilStatus(
      'disconnected',
      extension.webRtcClient.subjects.wsStatusSubject
    )
    wallet.webRtcClient.subjects.rtcIceConnectionStateSubject.next('failed')

    await waitUntilOpen(
      'connected',
      wallet.webRtcClient.subjects.wsStatusSubject
    )
    await waitUntilOpen(
      'connected',
      extension.webRtcClient.subjects.wsStatusSubject
    )

    wallet.webRtcClient.subjects.rtcCreateOfferSubject.next()

    await waitUntilOpen(
      'connected',
      wallet.webRtcClient.subjects.rtcStatusSubject
    )
    await waitUntilOpen(
      'connected',
      extension.webRtcClient.subjects.rtcStatusSubject
    )

    await waitUntilStatus(
      'disconnected',
      wallet.webRtcClient.subjects.wsStatusSubject
    )
    await waitUntilStatus(
      'disconnected',
      extension.webRtcClient.subjects.wsStatusSubject
    )

    const walletIncomingMessage = subscribeSpyTo(
      wallet.webRtcClient.subjects.rtcIncomingMessageSubject
    )

    extension.messageClient.subjects.addMessageSubject.next(
      'hello from extension'
    )

    await delayAsync()

    expect(walletIncomingMessage.getValues()).toEqual([
      JSON.stringify('hello from extension'),
    ])
  }, 30_000)
})
