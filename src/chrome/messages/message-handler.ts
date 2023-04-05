import { concatMap, filter, Subject, Subscription } from 'rxjs'
import { BackgroundMessageHandler } from './background-messages'
import { ContentScriptMessageHandler } from './content-script-messages'
import { OffscreenMessageHandler } from './offscreen-messages'
import {
  BackgroundMessage,
  ContentScriptMessage,
  Message,
  OffScreenMessage,
} from './_types'

export const MessageHandler = (input: {
  offscreenMessageHandler?: OffscreenMessageHandler
  backgroundMessageHandler?: BackgroundMessageHandler
  contentScriptMessageHandler?: ContentScriptMessageHandler
}) => {
  const offscreenMessageHandler = input.offscreenMessageHandler
  const backgroundMessageHandler = input.backgroundMessageHandler
  const contentScriptMessageHandler = input.contentScriptMessageHandler

  const messageSubject = new Subject<{ message: Message; tabId?: number }>()

  const subscriptions = new Subscription()

  const offScreenMessage$ = messageSubject.pipe(
    filter(
      (value): value is { message: OffScreenMessage; tabId?: number } =>
        value.message.target === 'offScreen'
    )
  )

  const backgroundMessage$ = messageSubject.pipe(
    filter(
      (value): value is { message: BackgroundMessage; tabId?: number } =>
        value.message.target === 'background'
    )
  )

  const contentScriptMessage$ = messageSubject.pipe(
    filter(
      (value): value is { message: ContentScriptMessage; tabId?: number } =>
        value.message.target === 'contentScript'
    )
  )

  if (offscreenMessageHandler)
    subscriptions.add(
      offScreenMessage$
        .pipe(
          concatMap(({ message, tabId }) =>
            offscreenMessageHandler(message, tabId)
          )
        )
        .subscribe()
    )

  if (backgroundMessageHandler)
    subscriptions.add(
      backgroundMessage$
        .pipe(concatMap(({ message }) => backgroundMessageHandler(message)))
        .subscribe()
    )

  if (contentScriptMessageHandler)
    subscriptions.add(
      contentScriptMessage$
        .pipe(
          concatMap(async ({ message }) => contentScriptMessageHandler(message))
        )
        .subscribe()
    )

  return {
    onMessage: (message: Message, tabId?: number) =>
      messageSubject.next({ message, tabId }),
    destroy: () => {
      subscriptions.unsubscribe()
    },
  }
}
