import WSS from 'jest-websocket-mock'
import { SignalingServerClient } from '../signaling-server-client'
import { subjects, Status } from '../subjects'
import { subscribeSpyTo } from '@hirez_io/observer-spy'
import { filter, firstValueFrom } from 'rxjs'
import { err, ok } from 'neverthrow'
import log from 'loglevel'
import { createIV, encrypt } from 'crypto/encryption'
import { MessageHandler } from '../message-handler'
import { delayAsync } from 'test-utils/delay-async'

const url =
  'ws://localhost:1234/3ba6fa025c3c304988133c081e9e3f5347bf89421f6445b07abfacd94956a09a?target=wallet&source=extension'
let wss: WSS
SignalingServerClient({ baseUrl: url, subjects })
const { sendMessageWithConfirmation } = MessageHandler(subjects)

let wsStatusSpy: ReturnType<typeof subscribeSpyTo<Status>>
let wsErrorSpy: ReturnType<typeof subscribeSpyTo<Event>>
let wsIncomingMessageSpy: ReturnType<
  typeof subscribeSpyTo<MessageEvent<string>>
>

const waitUntilStatus = async (status: Status) =>
  firstValueFrom(subjects.wsStatusSubject.pipe(filter((s) => s === status)))

describe('Signaling server client', () => {
  beforeEach(async () => {
    log.setLevel('silent')
    subjects.wsConnectionPasswordSubject.next(
      Buffer.from([192, 218, 52, 1, 230])
    )

    WSS.clean()
    await delayAsync(10)
    wsStatusSpy = subscribeSpyTo(subjects.wsStatusSubject)
    wsErrorSpy = subscribeSpyTo(subjects.wsErrorSubject)
    wsIncomingMessageSpy = subscribeSpyTo(subjects.wsIncomingRawMessageSubject)
    wss = new WSS(url)
    subjects.wsConnectSubject.next(true)
    await waitUntilStatus('connected')
    log.setLevel('debug')
  })

  it('should successfully connect and emit status', async () => {
    expect(wsStatusSpy.getValues()).toEqual([
      'disconnected',
      'connecting',
      'connected',
    ])
  })

  it('should emit error and status', async () => {
    wss.error()
    expect(wsErrorSpy.getValues()[0]).toBeTruthy()
    expect(wsStatusSpy.getValues()).toEqual([
      'disconnected',
      'connecting',
      'connected',
      'disconnected',
    ])
  })

  it('should reconnect if disconnected', async () => {
    WSS.clean()
    wss = new WSS(url)
    await waitUntilStatus('connected')
    expect(wsStatusSpy.getValues()).toEqual([
      'disconnected',
      'connecting',
      'connected',
      'disconnected',
      'connecting',
      'connected',
    ])
  })

  it('should send a message to ws server', async () => {
    subjects.wsOutgoingMessageSubject.next('hi from client')
    expect(wss).toReceiveMessage('hi from client')
  })

  it('should receive a message from ws server', async () => {
    const message = JSON.stringify({
      encryptedPayload: 'secret stuff here',
      connectionId: 'abc',
      method: 'offer',
      source: 'iOS',
      requestId: crypto.randomUUID(),
    })
    wss.send(message)

    const actual: MessageEvent<string>[] = wsIncomingMessageSpy.getValues()

    expect(actual[0].data).toBe(message)
  })

  describe('message confirmation', () => {
    let messageConfirmationSpy: ReturnType<typeof subscribeSpyTo<any>>

    const message = {
      encryptedPayload: '123',
      connectionId: '1',
      method: 'answer',
      source: 'extension',
      requestId: crypto.randomUUID(),
    }

    beforeEach(async () => {
      messageConfirmationSpy = subscribeSpyTo(
        sendMessageWithConfirmation(ok(message as any), 300)
      )
    })

    it('should send a message with ok confirmation', async () => {
      expect(wss).toReceiveMessage(JSON.stringify(message))

      wss.send(
        JSON.stringify({ info: 'confirmation', requestId: message.requestId })
      )

      expect(messageConfirmationSpy.getValues()).toEqual([ok(true)])
    })

    it('should fail message confirmation due to timeout', async () => {
      subjects.wsOutgoingMessageSubject.next(JSON.stringify(message))

      expect(wss).toReceiveMessage(JSON.stringify(message))

      await delayAsync()

      expect(messageConfirmationSpy.getValues()).toEqual([
        err({ requestId: message.requestId, reason: 'timeout' }),
      ])
    })

    it('should fail message confirmation due to ws error', async () => {
      wss.error()

      expect(messageConfirmationSpy.getValues()).toEqual([
        err({ requestId: message.requestId, reason: 'error' }),
      ])
    })
  })

  describe('decrypt message payload', () => {
    beforeEach(() => {
      subjects.wsConnectionPasswordSubject.next(
        Buffer.from([192, 218, 52, 1, 230])
      )
    })
    afterEach(() => {
      subjects.wsConnectionPasswordSubject.next(undefined)
    })
    it('should decrypt payload and send to offer subject', async () => {
      const expectedBech32Password = 'CRDRGQ0X'
      const wsConnectionSecretsSpy = subscribeSpyTo(
        subjects.wsConnectionSecrets$
      )
      const rtcRemoteOfferSpy = subscribeSpyTo(subjects.rtcRemoteOfferSubject)

      await delayAsync(100)

      const secretsResult = wsConnectionSecretsSpy.getValueAt(0)

      if (secretsResult.isErr()) throw secretsResult.error

      const secrets = secretsResult.value

      expect(secrets.passwordBech32).toEqual(expectedBech32Password)

      const offerPayload = {
        sdp: 'v=0\r\no=- 9071002879172211114 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=extmap-allow-mixed\r\na=msid-semantic: WMS\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\na=ice-ufrag:ANaE\r\na=ice-pwd:2nJbdtiNceHOsCsnJ4qUKTbG\r\na=ice-options:trickle\r\na=fingerprint:sha-256 3F:AF:30:C3:48:90:25:8F:98:0B:3E:E2:CA:4F:D4:A7:07:DE:5F:B4:EC:B1:14:B8:E3:D4:22:43:01:64:0D:63\r\na=setup:actpass\r\na=mid:0\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n',
      }

      // eslint-disable-next-line max-nested-callbacks
      const encryptedResult = await createIV().asyncAndThen((iv) =>
        encrypt(
          Buffer.from(JSON.stringify(offerPayload)),
          secrets.encryptionKey,
          iv
        )
      )

      if (encryptedResult.isErr()) throw encryptedResult.error

      const encrypted = encryptedResult.value

      const requestId = crypto.randomUUID()

      const message = {
        info: 'remoteData',
        requestId,
        data: {
          encryptedPayload: encrypted.combined.toString('hex'),
          connectionId: secrets.connectionId.toString('hex'),
          method: 'offer',
          source: 'wallet',
          requestId,
        },
      }

      wss.send(JSON.stringify(message))

      await delayAsync()

      expect(rtcRemoteOfferSpy.getValueAt(0)).toEqual({
        ...offerPayload,
        type: 'offer',
      })
    })
  })
})
