import { filter, of, Subject, tap } from 'rxjs'

export const sendChunks = (
  sendMessageOverDataChannelSubject: Subject<string>,
  chunks: string[]
) =>
  of(...chunks).pipe(
    tap((chunk) => sendMessageOverDataChannelSubject.next(chunk)),
    filter(() => false)
  )
