import { config } from 'config'
import { ConnectorClient } from 'connector/connector-client'
import {
  SignalingSubjects,
  SignalingSubjectsType,
} from 'connector/signaling/subjects'
import { WebRtcSubjects, WebRtcSubjectsType } from 'connector/webrtc/subjects'
import { Status } from 'connector/_types'
import { filter, firstValueFrom } from 'rxjs'
import { delayAsync } from 'test-utils/delay-async'
import { Logger } from 'tslog'

describe('connector client', () => {
  let extensionLogger = new Logger({ name: 'extensionConnector', minLevel: 2 })
  let walletLogger = new Logger({ name: 'walletConnector', minLevel: 2 })
  let extensionConnector: ConnectorClient
  let walletConnector: ConnectorClient
  let extensionWebRtcSubjects: WebRtcSubjectsType
  let walletWebRtcSubjects: WebRtcSubjectsType
  let extensionSignalingSubjects: SignalingSubjectsType
  const password = Buffer.from(
    '9e47e1afc8a02b626cb4db4c4c7d92a0f3a58949eded93f87b0a966bf9075b3f',
    'hex'
  )

  const waitForDataChannelStatus = (
    subjects: WebRtcSubjectsType,
    value: 'open' | 'closed'
  ) =>
    firstValueFrom(
      subjects.dataChannelStatusSubject.pipe(
        filter((status) => status === value)
      )
    )

  const waitForSignalingServerStatus = (
    subjects: SignalingSubjectsType,
    value: Status
  ) =>
    firstValueFrom(
      subjects.statusSubject.pipe(filter((status) => status === value))
    )

  const createExtensionConnector = () => {
    extensionConnector = ConnectorClient({
      source: 'extension',
      target: 'wallet',
      signalingServerBaseUrl: config.signalingServer.baseUrl,
      logger: extensionLogger,
      isInitiator: false,
      createSignalingSubjects: () => extensionSignalingSubjects,
      createWebRtcSubjects: () => extensionWebRtcSubjects,
    })
  }

  const createWalletConnector = () => {
    walletConnector = ConnectorClient({
      source: 'wallet',
      target: 'extension',
      signalingServerBaseUrl: config.signalingServer.baseUrl,
      // logger: walletLogger,
      isInitiator: true,
      createWebRtcSubjects: () => walletWebRtcSubjects,
    })
  }

  beforeEach(() => {
    extensionLogger.settings.minLevel = 2
    walletLogger.settings.minLevel = 2

    extensionWebRtcSubjects = WebRtcSubjects()
    extensionSignalingSubjects = SignalingSubjects()
    walletWebRtcSubjects = WebRtcSubjects()
  })

  afterEach(async () => {
    walletLogger.settings.minLevel = 3
    extensionLogger.settings.minLevel = 3
    extensionConnector?.destroy()
    walletConnector?.destroy()
    // wait for cleanup to finish
    await delayAsync(100)
  })

  it('should open data channel between two peers', async () => {
    createExtensionConnector()
    createWalletConnector()
    extensionConnector.setConnectionPassword(password)
    extensionConnector.connect()

    walletConnector.setConnectionPassword(password)
    walletConnector.connect()

    expect(
      await waitForDataChannelStatus(extensionWebRtcSubjects, 'open')
    ).toBe('open')
  })

  it('should reconnect to SS if connection password is changed', async () => {
    createExtensionConnector()

    extensionConnector.setConnectionPassword(password)
    extensionConnector.connect()

    await waitForSignalingServerStatus(extensionSignalingSubjects, 'connected')

    await extensionConnector.generateConnectionPassword()

    await waitForSignalingServerStatus(
      extensionSignalingSubjects,
      'disconnected'
    )

    expect(
      await waitForSignalingServerStatus(
        extensionSignalingSubjects,
        'connected'
      )
    ).toBe('connected')
  })

  it('should wait for connection password before connecting', async () => {
    createExtensionConnector()
    extensionConnector.connect()

    expect(
      await waitForSignalingServerStatus(
        extensionSignalingSubjects,
        'disconnected'
      )
    ).toBe('disconnected')

    extensionConnector.setConnectionPassword(password)

    expect(
      await waitForSignalingServerStatus(
        extensionSignalingSubjects,
        'connected'
      )
    ).toBe('connected')
  })

  it('should queue a message and send it after data channel has opened', async () => {
    createExtensionConnector()
    createWalletConnector()

    extensionConnector.sendMessage({ foo: 'bar' })

    extensionConnector.setConnectionPassword(password)
    extensionConnector.connect()

    walletConnector.setConnectionPassword(password)
    walletConnector.connect()

    await waitForDataChannelStatus(extensionWebRtcSubjects, 'open')

    expect(await firstValueFrom(walletConnector.onMessage$)).toEqual({
      foo: 'bar',
    })
  })

  it('should open data channel and send message', async () => {
    createExtensionConnector()
    createWalletConnector()

    extensionConnector.setConnectionPassword(password)
    extensionConnector.connect()

    walletConnector.setConnectionPassword(password)
    walletConnector.connect()

    await waitForDataChannelStatus(extensionWebRtcSubjects, 'open')

    extensionConnector.sendMessage({ foo: 'bar' })

    await firstValueFrom(
      extensionWebRtcSubjects.onDataChannelMessageSubject.pipe(
        filter(
          (message) => message.packageType === 'receiveMessageConfirmation'
        )
      )
    )
  })
})
