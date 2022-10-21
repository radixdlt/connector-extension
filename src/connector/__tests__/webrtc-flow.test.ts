import log from 'loglevel'
import { filter, firstValueFrom, Observable } from 'rxjs'
import { subscribeSpyTo } from '@hirez_io/observer-spy'
import { config } from '../../config'
import { delayAsync } from 'test-utils/delay-async'
import { Connector, ConnectorType } from '../connector'
import { Status } from 'connector/_types'

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
  bootstrap: async (client: ConnectorType) => {
    client.signaling.subjects.wsConnectionPasswordSubject.next(
      Buffer.from([
        101, 11, 188, 67, 254, 113, 165, 152, 53, 19, 118, 227, 195, 21, 110,
        83, 145, 197, 78, 134, 31, 238, 50, 160, 207, 34, 245, 16, 26, 135, 105,
        96,
      ])
    )
    client.signaling.subjects.wsConnectSubject.next(true)

    await waitUntilStatus(
      'connected',
      client.signaling.subjects.wsStatusSubject
    )
  },

  cleanup: async (client: ConnectorType) => {
    client.webRtc.subjects.rtcConnectSubject.next(false)
    await waitUntilOpen('disconnected', client.webRtc.subjects.rtcStatusSubject)
    client.destroy()
    await waitUntilStatus(
      'disconnected',
      client.signaling.subjects.wsStatusSubject
    )
    await waitUntilOpen('disconnected', client.webRtc.subjects.rtcStatusSubject)
  },
}

let wallet: ConnectorType
let extension: ConnectorType

describe('webRTC flow', () => {
  beforeEach(async () => {
    extension = Connector({
      logLevel: 'silent',
      signalingLogLevel: 'silent',
      webRtcLoglevel: 'silent',
      storageLogLevel: 'silent',
      storageOptions: { id: crypto.randomUUID() },
    })

    wallet = Connector({
      logLevel: 'silent',
      signalingLogLevel: 'silent',
      webRtcLoglevel: 'silent',
      storageLogLevel: 'silent',
      webRtcClientOptions: config.webRTC,
      signalingClientOptions: {
        ...config.signalingServer,
        source: 'wallet',
        target: 'extension',
      },
      storageOptions: { id: crypto.randomUUID() },
    })

    await WebRtcTestHelper.bootstrap(wallet)
    await WebRtcTestHelper.bootstrap(extension)
  }, 30_000)

  afterEach(async () => {
    log.setLevel('silent')
    wallet.destroy()
    extension.destroy()
  })

  it('should send message over data channel between two clients', async () => {
    wallet.webRtc.subjects.rtcConnectSubject.next(true)
    extension.webRtc.subjects.rtcConnectSubject.next(true)

    wallet.webRtc.subjects.rtcCreateOfferSubject.next()

    await waitUntilOpen('connected', wallet.webRtc.subjects.rtcStatusSubject)
    await waitUntilOpen('connected', extension.webRtc.subjects.rtcStatusSubject)

    const walletIncomingMessage = subscribeSpyTo(
      wallet.webRtc.subjects.rtcIncomingMessageSubject
    )
    const extensionIncomingMessage = subscribeSpyTo(
      extension.webRtc.subjects.rtcIncomingMessageSubject
    )

    const message = oneMB.slice(0, oneMB.length / 1000)

    await waitUntilStatus(
      'disconnected',
      wallet.signaling.subjects.wsStatusSubject
    )
    await waitUntilStatus(
      'disconnected',
      extension.signaling.subjects.wsStatusSubject
    )

    wallet.webRtc.subjects.rtcAddMessageToQueue.next(message)
    extension.webRtc.subjects.rtcAddMessageToQueue.next('hello from extension')

    await delayAsync()

    expect(extensionIncomingMessage.getValues()).toEqual([message])
    expect(walletIncomingMessage.getValues()).toEqual(['hello from extension'])
  }, 30_000)

  it('should reconnect if a client disconnects', async () => {
    log.setLevel('silent')
    wallet.webRtc.subjects.rtcConnectSubject.next(true)
    extension.webRtc.subjects.rtcConnectSubject.next(true)

    wallet.webRtc.subjects.rtcCreateOfferSubject.next()
    await waitUntilOpen('connected', wallet.webRtc.subjects.rtcStatusSubject)
    await waitUntilOpen('connected', extension.webRtc.subjects.rtcStatusSubject)

    await waitUntilStatus(
      'disconnected',
      wallet.signaling.subjects.wsStatusSubject
    )
    await waitUntilStatus(
      'disconnected',
      extension.signaling.subjects.wsStatusSubject
    )
    wallet.webRtc.subjects.rtcIceConnectionStateSubject.next('failed')

    await waitUntilOpen('connected', wallet.signaling.subjects.wsStatusSubject)
    await waitUntilOpen(
      'connected',
      extension.signaling.subjects.wsStatusSubject
    )

    wallet.webRtc.subjects.rtcCreateOfferSubject.next()

    await waitUntilOpen('connected', wallet.webRtc.subjects.rtcStatusSubject)
    await waitUntilOpen('connected', extension.webRtc.subjects.rtcStatusSubject)

    await waitUntilStatus(
      'disconnected',
      wallet.signaling.subjects.wsStatusSubject
    )
    await waitUntilStatus(
      'disconnected',
      extension.signaling.subjects.wsStatusSubject
    )

    const walletIncomingMessage = subscribeSpyTo(
      wallet.webRtc.subjects.rtcIncomingMessageSubject
    )

    extension.webRtc.subjects.rtcAddMessageToQueue.next('hello from extension')

    await delayAsync()

    expect(walletIncomingMessage.getValues()).toEqual(['hello from extension'])
  }, 30_000)
})
