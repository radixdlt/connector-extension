import { SubjectsType } from 'connections/subjects'
import { combineLatest, filter, tap } from 'rxjs'

export const rtcRestart = (subjects: SubjectsType) =>
  combineLatest([
    subjects.rtcIceConnectionState,
    subjects.rtcConnectSubject,
  ]).pipe(
    filter(
      ([state, shouldConnect]) =>
        ['disconnected', 'failed'].includes(state) && shouldConnect
    ),
    tap(() => subjects.rtcRestart.next())
  )
