import { describe, it, expect, vi } from 'vitest'
import type { AppLogger } from 'utils/logger'
import { WebRtcDiagnosticsTracker } from './webrtc-diagnostics'

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const createTracker = () => {
  const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
  const clock = { time: 1_000 }
  const tracker = WebRtcDiagnosticsTracker({
    logger: logger as unknown as AppLogger,
    negotiationTimeoutMs: 30,
    logRepeatIntervalMs: 60_000,
    now: () => clock.time,
  })
  tracker.setSignalingServer('wss://signaling.example.com')
  // A connection attempt, as the ConnectorClient makes it.
  const signaling = tracker.createSignalingSubjects()
  const webRtc = tracker.createWebRtcSubjects()
  return { logger, tracker, signaling, webRtc, clock }
}

const offer = {
  method: 'offer' as const,
  payload: { sdp: 'v=0' },
  source: 'extension' as const,
}

describe('WebRtcDiagnosticsTracker', () => {
  it('logs signaling errors as warnings with the server, once per interval', () => {
    const { logger, tracker, signaling } = createTracker()

    signaling.onErrorSubject.next(new Event('error'))
    signaling.onErrorSubject.next(new Event('error'))
    signaling.onErrorSubject.next(new Event('error'))

    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^webrtc: signaling server error/),
      { signalingServer: 'wss://signaling.example.com' },
    )
    expect(tracker.diagnostics().lastError).toEqual({
      message: expect.stringMatching(/^signaling server error/),
      at: 1_000,
    })
  })

  it('reports and logs ICE and peer connection failures', () => {
    const { logger, tracker, webRtc } = createTracker()

    webRtc.iceConnectionStateSubject.next('failed')
    webRtc.peerConnectionStateSubject.next('failed')

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^webrtc: ICE failed/),
      expect.anything(),
    )
    expect(logger.warn).toHaveBeenCalledWith(
      'webrtc: peer connection failed',
      expect.anything(),
    )
    expect(tracker.diagnostics()).toMatchObject({
      iceConnectionState: 'failed',
      peerConnectionState: 'failed',
      lastError: { message: 'peer connection failed' },
    })
  })

  it('logs a negotiation that does not open the data channel in time', async () => {
    const { logger, webRtc } = createTracker()

    webRtc.offerSubject.next(offer)
    await sleep(50)

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/^webrtc: negotiation timed out after 30 ms/),
      expect.anything(),
    )
  })

  it('does not report a negotiation that opened the data channel', async () => {
    const { logger, webRtc } = createTracker()

    webRtc.offerSubject.next(offer)
    webRtc.dataChannelStatusSubject.next('open')
    await sleep(50)

    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('stops watching the subjects of a previous attempt', async () => {
    const { logger, tracker, webRtc } = createTracker()
    webRtc.offerSubject.next(offer)

    tracker.createWebRtcSubjects()
    webRtc.peerConnectionStateSubject.next('failed')
    await sleep(50)

    expect(logger.warn).not.toHaveBeenCalled()
    expect(tracker.diagnostics().peerConnectionState).toBeUndefined()
  })

  it('logs connection changes and reports the signaling state', () => {
    const { logger, tracker, signaling, clock } = createTracker()

    signaling.statusSubject.next('connected')
    tracker.setConnected(true)
    clock.time += 1_500
    expect(tracker.diagnostics()).toMatchObject({
      connected: true,
      signalingConnected: true,
      signalingServer: 'wss://signaling.example.com',
      connectedForMs: 1_500,
      connects: 1,
    })

    tracker.setConnected(false)
    signaling.statusSubject.next('disconnected')

    expect(logger.info).toHaveBeenCalledWith(
      'webrtc: connected to the signaling server, waiting for the wallet',
      { signalingServer: 'wss://signaling.example.com' },
    )
    expect(logger.info).toHaveBeenCalledWith(
      'webrtc: connected to the wallet',
      {
        connects: 1,
      },
    )
    expect(logger.info).toHaveBeenCalledWith(
      'webrtc: disconnected from the wallet',
      expect.objectContaining({ connectedForMs: 1_500 }),
    )
    expect(tracker.diagnostics().connectedForMs).toBeUndefined()
    expect(logger.info).toHaveBeenCalledWith(
      'webrtc: disconnected from the signaling server',
      expect.anything(),
    )
  })

  it('stops its timers when destroyed', async () => {
    const { logger, tracker, webRtc } = createTracker()
    webRtc.offerSubject.next(offer)

    tracker.destroy()
    await sleep(50)

    expect(logger.warn).not.toHaveBeenCalled()
  })
})
