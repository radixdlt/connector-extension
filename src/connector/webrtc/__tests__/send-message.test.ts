/* eslint-disable max-nested-callbacks */
import log from 'loglevel'
import { delay, firstValueFrom, Subject, Subscription } from 'rxjs'
import { rtcOutgoingMessage } from '../observables/rtc-outgoing-message'
import { rtcMessageQueue } from '../observables/rtc-message-queue'
import { WebRtcSubjects, WebRtcSubjectsType } from '../subjects'
import { ChunkedMessageType } from '../data-chunking'
import { ok, Result } from 'neverthrow'

describe('send message over webRTC data channel', () => {
  let webRtcSubjects: WebRtcSubjectsType
  let rtcOutgoingMessage$: ReturnType<typeof rtcOutgoingMessage>
  let rtcMessageQueue$: ReturnType<typeof rtcMessageQueue>
  let mockedIncomingMessageSubject = new Subject<
    Result<ChunkedMessageType, Error>
  >()
  let subscriptions: Subscription
  const logger = log
  logger.setLevel('silent')

  beforeEach(() => {
    subscriptions = new Subscription()
    webRtcSubjects = WebRtcSubjects()
    rtcOutgoingMessage$ = rtcOutgoingMessage(
      webRtcSubjects,
      mockedIncomingMessageSubject,
      logger
    )
    rtcMessageQueue$ = rtcMessageQueue(webRtcSubjects, logger)
  })
  afterEach(() => {
    subscriptions.unsubscribe()
  })
  it('should receive message confirmation', (done) => {
    firstValueFrom(rtcOutgoingMessage$).then((result) => {
      if (result.isErr()) {
        throw result.error
      }
      expect(result.value.packageType).toBe('receiveMessageConfirmation')
      done()
    })

    webRtcSubjects.rtcOutgoingMessageSubject.next('test')

    firstValueFrom(
      webRtcSubjects.rtcOutgoingChunkedMessageSubject.pipe(delay(0))
    ).then((message) => {
      const messageId = JSON.parse(message).messageId
      mockedIncomingMessageSubject.next(
        ok({
          packageType: 'receiveMessageConfirmation',
          messageId,
        })
      )
    })
  })

  it('should receive timeout', (done) => {
    firstValueFrom(rtcOutgoingMessage$).then((result) => {
      if (result.isErr()) {
        expect(result.error).toBe('timeout')
        return done()
      }
      throw new Error('should have received timeout error')
    })

    webRtcSubjects.rtcOutgoingMessageSubject.next('test')
  })

  it('should retry message if timed out', async () => {
    firstValueFrom(rtcMessageQueue$)
    webRtcSubjects.rtcAddMessageToQueueSubject.next('test')
    webRtcSubjects.rtcStatusSubject.next('connected')

    expect(
      await firstValueFrom(webRtcSubjects.rtcSendMessageRetrySubject)
    ).toBe('test')
  })
})
