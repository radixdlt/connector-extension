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

    const message = `Cerberus is the unique consensus protocol underpinning Radix. It took seven years of research, starting in 2013 and culminating in the Cerberus Whitepaper in 2020. How Cerberus is going to be implemented in its final fully sharded form is the focus of Radix Labs and Cassandra.

In its final form, Cerberus represents a radically different paradigm in the design of decentralized Distributed Ledger Technology systems. It is the only protocol that is designed so that all transactions are atomically composed across shards. This is a critical feature if DeFi is to ever scale to billions of users.
    
Cerberus takes a well-proven 'single-pipe' BFT (Byzantine Fault Tolerance) consensus process and parallelizes it across an extensive set of instances or shards – practically an unlimited number of shards. It achieves this parallelization through a unique new 'braided' synchronization of consensus across shards, as required by the 'dependencies' of each transaction. This requires the use of a specialized application layer called the Radix Engine.
    
All of this provides Cerberus with practically infinite 'linear' scalability. This means that as more nodes are added to the Radix Public Network, throughput increases linearly. As a result, Cerberus is the only consensus protocol that is capable of supporting the global financial system on a decentralized network.`

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
})
