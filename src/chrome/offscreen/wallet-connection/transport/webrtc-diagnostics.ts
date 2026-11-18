import {
  SignalingSubjects,
  WebRtcSubjects,
} from '@radixdlt/radix-connect-webrtc'
import { Subscription } from 'rxjs'
import type { AppLogger } from 'utils/logger'
import { LimitedLogger } from 'utils/limited-logger'
import type { TransportError, WebRtcDiagnostics } from './diagnostics'

/**
 * Follows a `ConnectorClient` through the subjects it creates for every connection
 * attempt (passed in as `createSignalingSubjects` / `createWebRtcSubjects`), to log
 * its failures as warnings (the library only logs them at debug level) and to
 * report its state. It only observes: the subjects behave as the library's own.
 */
export const WebRtcDiagnosticsTracker = (input: {
  logger?: AppLogger
  negotiationTimeoutMs: number
  logRepeatIntervalMs: number
  now?: () => number
}) => {
  const now = input.now ?? Date.now
  const log = LimitedLogger(input.logger, {
    intervalMs: input.logRepeatIntervalMs,
    now,
  })
  // Connections that come and go are worth seeing one by one, unless they flap.
  const lifecycleLog = LimitedLogger(input.logger, {
    intervalMs: input.logRepeatIntervalMs,
    burst: 10,
    now,
  })

  let connected = false
  let signalingServer: string | undefined
  let signalingConnected = false
  let peerConnectionState: RTCPeerConnectionState | undefined
  let iceConnectionState: RTCIceConnectionState | undefined
  let dataChannelOpen = false
  let lastError: TransportError | undefined
  let connectedAt: number | undefined
  let connects = 0

  let signalingAttempt = new Subscription()
  let webRtcAttempt = new Subscription()
  let negotiationTimer: ReturnType<typeof setTimeout> | undefined

  const clearNegotiationTimer = () => {
    if (negotiationTimer) clearTimeout(negotiationTimer)
    negotiationTimer = undefined
  }

  const fail = (key: string, message: string) => {
    lastError = { message, at: now() }
    log.warn(key, `webrtc: ${message}`, { signalingServer })
  }

  const createSignalingSubjects = () => {
    const subjects = SignalingSubjects()
    signalingAttempt.unsubscribe()
    signalingAttempt = new Subscription()
    signalingAttempt.add(
      subjects.statusSubject.subscribe((status) => {
        const wasConnected = signalingConnected
        signalingConnected = status === 'connected'
        if (!wasConnected && signalingConnected)
          log.info(
            'signaling-connected',
            'webrtc: connected to the signaling server, waiting for the wallet',
            { signalingServer },
          )
        if (wasConnected && !signalingConnected)
          log.info(
            'signaling-disconnected',
            'webrtc: disconnected from the signaling server',
            { signalingServer },
          )
      }),
    )
    signalingAttempt.add(
      subjects.onErrorSubject.subscribe(() =>
        fail(
          'signaling-error',
          'signaling server error: offline, or the server is unreachable or rejected the connection',
        ),
      ),
    )
    return subjects
  }

  const createWebRtcSubjects = () => {
    const subjects = WebRtcSubjects()
    webRtcAttempt.unsubscribe()
    clearNegotiationTimer()
    dataChannelOpen = false
    webRtcAttempt = new Subscription()
    webRtcAttempt.add(
      subjects.peerConnectionStateSubject.subscribe((state) => {
        peerConnectionState = state
        if (state === 'failed')
          fail('peer-connection-failed', 'peer connection failed')
      }),
    )
    webRtcAttempt.add(
      subjects.iceConnectionStateSubject.subscribe((state) => {
        iceConnectionState = state
        if (state === 'failed')
          fail(
            'ice-failed',
            'ICE failed: no network path to the wallet (firewall, or TURN server unreachable)',
          )
      }),
    )
    webRtcAttempt.add(
      subjects.dataChannelStatusSubject.subscribe((status) => {
        const open = status === 'open'
        if (open) clearNegotiationTimer()
        if (dataChannelOpen && !open)
          log.info('data-channel-closed', 'webrtc: data channel closed')
        dataChannelOpen = open
      }),
    )
    // The library restarts the attempt when the data channel is not open in time
    // after the offer, without saying why.
    webRtcAttempt.add(
      subjects.offerSubject.subscribe(() => {
        clearNegotiationTimer()
        negotiationTimer = setTimeout(
          () =>
            fail(
              'negotiation-timeout',
              `negotiation timed out after ${input.negotiationTimeoutMs} ms: the wallet did not complete the connection`,
            ),
          input.negotiationTimeoutMs,
        )
      }),
    )
    return subjects
  }

  const setConnected = (value: boolean) => {
    if (value === connected) return
    connected = value
    if (value) {
      connectedAt = now()
      connects += 1
      lifecycleLog.info('connected', 'webrtc: connected to the wallet', {
        connects,
      })
    } else {
      const connectedForMs =
        connectedAt === undefined ? undefined : now() - connectedAt
      connectedAt = undefined
      lifecycleLog.info(
        'disconnected',
        'webrtc: disconnected from the wallet',
        {
          connectedForMs,
          peerConnectionState,
          iceConnectionState,
          signalingServer,
        },
      )
    }
  }

  const diagnostics = (): WebRtcDiagnostics => ({
    connected,
    signalingServer,
    signalingConnected,
    peerConnectionState,
    iceConnectionState,
    lastError,
    connectedForMs: connectedAt === undefined ? undefined : now() - connectedAt,
    connects,
  })

  return {
    createSignalingSubjects,
    createWebRtcSubjects,
    setConnected,
    setSignalingServer: (url: string) => {
      signalingServer = url
    },
    diagnostics,
    destroy: () => {
      clearNegotiationTimer()
      signalingAttempt.unsubscribe()
      webRtcAttempt.unsubscribe()
    },
  }
}
