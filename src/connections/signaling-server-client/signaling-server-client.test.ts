import WSS from 'jest-websocket-mock'
import { signalingServerClient } from './signaling-server-client'
import {
  wsStatusSubject,
  wsErrorSubject,
  wsOutgoingMessageSubject,
  wsIncomingMessageSubject,
  wsConnect,
  messageConfirmation,
  Status,
} from '../subjects'
import { subscribeSpyTo } from '@hirez_io/observer-spy'
import { filter, firstValueFrom } from 'rxjs'
import { err, ok } from 'neverthrow'

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
  beforeEach(async () => {
    wsStatusSpy = subscribeSpyTo(wsStatusSubject)
    wsErrorSpy = subscribeSpyTo(wsErrorSubject)
    wsIncomingMessageSpy = subscribeSpyTo(wsIncomingMessageSubject)
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

      expect(messageConfirmationSpy.getValues()).toEqual([ok('111')])
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
})
