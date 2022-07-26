import WSS from 'jest-websocket-mock'
import { signalingServerClient } from './signaling-server-client'
import {
  wsStatusSubject,
  wsErrorSubject,
  wsOutgoingMessageSubject,
  wsIncomingRawMessageSubject,
  wsConnect,
  messageConfirmation,
  Status,
  wsConnectionSecrets$,
  wsConnectionPasswordSubject,
  rtcRemoteOfferSubject,
} from '../subjects'
import { subscribeSpyTo } from '@hirez_io/observer-spy'
import { filter, firstValueFrom } from 'rxjs'
import { err, ok } from 'neverthrow'
import log from 'loglevel'
import { createIV, encrypt } from 'crypto/encryption'

const delay = (delayTime = 300) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayTime)
  })

const url = 'ws://localhost:1234'
let wss: WSS
signalingServerClient(url)

let wsStatusSpy: ReturnType<typeof subscribeSpyTo<Status>>
let wsErrorSpy: ReturnType<typeof subscribeSpyTo<Event>>
let wsIncomingMessageSpy: ReturnType<
  typeof subscribeSpyTo<MessageEvent<string>>
>

const waitUntilConnected = async () =>
  firstValueFrom(
    wsStatusSubject.pipe(filter((status) => status === 'connected'))
  )

describe('Signaling server client', () => {
  beforeAll(() => {
    log.setLevel('debug')
  })
  beforeEach(async () => {
    wsStatusSpy = subscribeSpyTo(wsStatusSubject)
    wsErrorSpy = subscribeSpyTo(wsErrorSubject)
    wsIncomingMessageSpy = subscribeSpyTo(wsIncomingRawMessageSubject)
    wss = new WSS(url)

    wsConnect.next()
    await waitUntilConnected()
  })

  afterEach(() => {
    WSS.clean()
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

  it('should send a message to ws server', async () => {
    wsOutgoingMessageSubject.next('hi from client')

    expect(wss).toReceiveMessage('hi from client')
  })

  it('should receive a message from ws server', async () => {
    wss.send('hi from ws server')

    const message: MessageEvent<string>[] = wsIncomingMessageSpy.getValues()

    expect(message[0].data).toBe('hi from ws server')
  })

  describe('message confirmation', () => {
    let messageConfirmationSpy: ReturnType<typeof subscribeSpyTo<any>>

    beforeEach(async () => {
      messageConfirmationSpy = subscribeSpyTo(
        messageConfirmation(message.requestId, 300)
      )
    })
    const message = { requestId: '111' }

    it('should send a message with ok confirmation', async () => {
      wsOutgoingMessageSubject.next(JSON.stringify(message))

      expect(wss).toReceiveMessage(JSON.stringify(message))

      wss.send(JSON.stringify({ valid: message }))

      expect(messageConfirmationSpy.getValues()).toEqual([ok(true)])
    })

    it('should fail message confirmation due to timeout', async () => {
      wsOutgoingMessageSubject.next(JSON.stringify(message))

      expect(wss).toReceiveMessage(JSON.stringify(message))

      await delay()

      expect(messageConfirmationSpy.getValues()).toEqual([
        err({ requestId: '111', reason: 'timeout' }),
      ])
    })

    it('should fail message confirmation due to ws error', async () => {
      wss.error()

      expect(messageConfirmationSpy.getValues()).toEqual([
        err({ requestId: '111', reason: 'error' }),
      ])
    })
  })

  describe('decrypt message payload', () => {
    beforeEach(() => {
      wsConnectionPasswordSubject.next(Buffer.from([192, 218, 52, 1, 230]))
    })
    afterEach(() => {
      wsConnectionPasswordSubject.next(undefined)
    })
    it('should decrypt payload and send to offer subject', async () => {
      const expectedBech32Password = 'crdrgq0x'
      const wsConnectionSecretsSpy = subscribeSpyTo(wsConnectionSecrets$)
      const rtcRemoteOfferSpy = subscribeSpyTo(rtcRemoteOfferSubject)

      await delay(100)

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

      const message = {
        encryptedPayload: encrypted.combined.toString('hex'),
        connectionId: secrets.connectionId.toString('hex'),
        method: 'offer',
        source: 'iOS',
        requestId: crypto.randomUUID(),
      }

      wss.send(JSON.stringify(message))

      await delay()

      expect(rtcRemoteOfferSpy.getValueAt(0)).toEqual({
        ...offerPayload,
        type: 'offer',
      })
    })
  })
})
