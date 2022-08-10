import { SubjectsType } from 'connections/subjects'
import { filter, tap } from 'rxjs'

export const rtcRestart = (subjects: SubjectsType) =>
  subjects.rtcIceConnectionStateSubject.pipe(
    filter((rtcIceConnectionState) =>
      ['failed', 'disconnected'].includes(rtcIceConnectionState || '')
    ),
    tap(() => subjects.rtcRestartSubject.next())
  )
