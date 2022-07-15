import { MockRTC, expect, delay } from '../test-setup'
// @ts-ignore
import data from './index.data'
import chunksToBuffer from 'utils/chunks-to-buffer'
import bufferToChunks from 'utils/buffer-to-chunks'

const mockRTC = MockRTC.getRemote({ recordMessages: true })

describe('MockRTC', () => {
  beforeEach(() => mockRTC.start())
  afterEach(() => mockRTC.stop())

  it('send chunks over and make sure the receiver is able to rebuild file', async () => {
    const mockPeer = await mockRTC.buildPeer().thenEcho()

    const localConnection = new RTCPeerConnection()
    const dataChannel = localConnection.createDataChannel('dataChannel')
    const localOffer = await localConnection.createOffer()
    await localConnection.setLocalDescription(localOffer)

    const { answer } = await mockPeer.answerOffer(localOffer)
    await localConnection.setRemoteDescription(answer)
    const chunks = bufferToChunks(data, 16384)

    dataChannel.onopen = () => {
      chunks.forEach((chunk) => {
        dataChannel.send(chunk)
      })
    }

    await delay(1500)

    const result = (await mockPeer.getAllMessages()) as Buffer[]

    expect(chunksToBuffer(result)).to.deep.equal(data)
  })

  it('send data in one go, without chunking should fail', async () => {
    const mockPeer = await mockRTC.buildPeer().thenEcho()

    const localConnection = new RTCPeerConnection()
    const dataChannel = localConnection.createDataChannel('dataChannel')
    const localOffer = await localConnection.createOffer()
    await localConnection.setLocalDescription(localOffer)

    const { answer } = await mockPeer.answerOffer(localOffer)
    await localConnection.setRemoteDescription(answer)

    dataChannel.onopen = () => {
      dataChannel.send(data)
    }

    await delay(1500)

    const result = await mockPeer.getAllMessages()

    expect(result).to.not.deep.equal(data)
  })
})
