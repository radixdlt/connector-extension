import { MockRTC, expect, delay } from '../test-setup'
// @ts-ignore
import data from './index.data'
import { chunksToBuffer, bufferToChunks } from 'utils'

const mockRTC = MockRTC.getRemote({ recordMessages: true })

let dataChannel: RTCDataChannel
let mockPeer: MockRTC.MockRTCPeer

const negotiation = async () => {
  mockPeer = await mockRTC.buildPeer().thenEcho()
  const localConnection = new RTCPeerConnection()
  dataChannel = localConnection.createDataChannel('dataChannel')
  const localOffer = await localConnection.createOffer()
  await localConnection.setLocalDescription(localOffer)
  const { answer } = await mockPeer.answerOffer(localOffer)
  await localConnection.setRemoteDescription(answer)
}

describe('MockRTC', () => {
  beforeEach(async () => {
    await mockRTC.start()
    await negotiation()
  })
  afterEach(async () => mockRTC.stop())

  it('send chunks over and make sure the receiver is able to rebuild file', async () => {
    const chunks = bufferToChunks(data, 16384)

    if (chunks.isErr()) throw chunks.error

    dataChannel.onopen = () => {
      chunks.value.forEach((chunk) => {
        dataChannel.send(chunk)
      })
    }

    await delay(1500)

    const result = (await mockPeer.getAllMessages()) as Buffer[]

    expect(chunksToBuffer(result).unwrapOr([])).to.deep.equal(data)
  })

  it('send data in one go, without chunking should fail', async () => {
    dataChannel.onopen = () => {
      dataChannel.send(data)
    }

    await delay(1500)

    const result = await mockPeer.getAllMessages()

    expect(result).to.not.deep.equal(data)
  })
})
