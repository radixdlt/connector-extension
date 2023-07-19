import { ResultAsync } from 'neverthrow'
export const createNotification = (
  id: string = crypto.randomUUID(),
  title: string = '',
  message: string = '',
  buttons: chrome.notifications.ButtonOptions[] = [],
) => {
  return ResultAsync.fromPromise(
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
}
