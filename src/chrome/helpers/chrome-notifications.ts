import { ResultAsync } from 'neverthrow'

/* eslint-disable max-params -- positional optional args mirror chrome.notifications */
export const createNotification = (
  id: string = crypto.randomUUID(),
  title = '',
  message = '',
  buttons: chrome.notifications.ButtonOptions[] = [],
) =>
  ResultAsync.fromPromise(
    new Promise((resolve) => {
      chrome.notifications.create(
        id,
        {
          type: 'basic',
          title,
          message,
          iconUrl: '/radix-icon_128x128.png',
          buttons,
        },
        (id) => {
          resolve(id)
        },
      )
    }),
    (e) => e as Error,
  )
/* eslint-enable max-params */
