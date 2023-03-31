import { filter, of, tap } from 'rxjs'
import { WebRtcSubjectsType } from '../subjects'

export const sendChunks = (subjects: WebRtcSubjectsType, chunks: string[]) =>
  of(...chunks).pipe(
    tap((chunk) => subjects.sendMessageOverDataChannelSubject.next(chunk)),
    filter(() => false)
  )
