import { config } from 'config'
import { sendMessageOverDataChannelAndWaitForConfirmation } from 'connector/webrtc/helpers/send-message-over-data-channel-and-wait-for-confirmation'
import { WebRtcClient } from 'connector/webrtc/webrtc-client'
import {
  concatMap,
  filter,
  first,
  merge,
  mergeMap,
  of,
  Subject,
  tap,
  timer,
} from 'rxjs'
import { MessageClientType } from '../message-client'

export const sendMessage = (input: {
  messageClient: MessageClientType
  webRtcClient: WebRtcClient
}) =>
  input.messageClient.messageQueue$.pipe(
    concatMap((message) => {
      const retryTrigger = new Subject<number>()
      return merge(of(0), retryTrigger).pipe(
        mergeMap((retryCount) =>
          merge(
            timer(config.webRTC.confirmationTimeout).pipe(
              tap(() => {
                retryTrigger.next(retryCount + 1)
              }),
              filter(() => false)
            ),
            sendMessageOverDataChannelAndWaitForConfirmation(
              input.webRtcClient.subjects,
              message
            ).pipe(
              tap((result) => {
                if (result.isErr()) retryTrigger.next(retryCount + 1)
                else input.messageClient.nextMessage()
              }),
              filter((result) => !result.isErr())
            )
          )
        ),
        first()
      )
    })
  )
