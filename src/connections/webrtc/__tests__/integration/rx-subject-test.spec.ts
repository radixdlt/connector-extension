import {
  rtcIncomingMessageSubject,
  rtcOutgoingMessageSubject,
  rtcStatusSubject,
  Status,
} from 'connections/subjects'
import { makeWebRTC } from 'connections/webrtc/webrtc-connection'
import { MockRTC, expect, delay } from '../test-setup'
import { SubscriberSpy, subscribeSpyTo } from '@hirez_io/observer-spy'
import { filter, firstValueFrom } from 'rxjs'

const mockRTC = MockRTC.getRemote({ recordMessages: true })

let mockPeer: MockRTC.MockRTCPeer
let rtcStatusSpy: SubscriberSpy<Status>

const waitUntilConnected = async () =>
  firstValueFrom(
    rtcStatusSubject.pipe(filter((status) => status === 'connected'))
  )

const negotiation = async (
  localConnection: RTCPeerConnection,
  mockPeer: MockRTC.MockRTCPeer
) => {
  const localOffer = await localConnection.createOffer()
  await localConnection.setLocalDescription(localOffer)
  const { answer } = await mockPeer.answerOffer(localOffer)
  await localConnection.setRemoteDescription(answer)
  await waitUntilConnected()
}

describe('MockRTC', () => {
  beforeEach(async () => {
    rtcStatusSpy = subscribeSpyTo(rtcStatusSubject)
    await mockRTC.start()

    mockPeer = await mockRTC
      .buildPeer()
      .waitForNextMessage()
      .thenSend('hello from mock')

    const { peerConnection: localConnection } = makeWebRTC()
    await negotiation(localConnection, mockPeer)
  })
  afterEach(async () => mockRTC.stop())

  it('should successfully connect and emit status', async () => {
    const result = rtcStatusSpy.getValues()
    expect(result).to.deep.equal(['disconnected', 'connected'])
  })

  it('should send a message to other peer and receive', async () => {
    const rtcIncomingMessageSubjectSpy = subscribeSpyTo(
      rtcIncomingMessageSubject
    )
    await delay(300)
    rtcOutgoingMessageSubject.next('hi from client')
    const result = await mockPeer.getAllMessages()
    expect(rtcIncomingMessageSubjectSpy.getValues().pop()).to.equal(
      'hello from mock'
    )
    expect(result.pop()).to.equal('hi from client')
  })
})
