import { SubjectsType } from 'connections/subjects'
import { combineLatest, filter, tap } from 'rxjs'

export const rtcRestart = (subjects: SubjectsType) =>
  combineLatest([
    subjects.rtcIceConnectionState,
    subjects.rtcConnectSubject,
    subjects.rtcStatusSubject,
  ]).pipe(
    filter(
      ([rtcIceConnectionState, shouldConnect, status]) =>
        (status === 'disconnected' ||
          (!!rtcIceConnectionState &&
            ['failed', 'disconnected'].includes(rtcIceConnectionState))) &&
        shouldConnect &&
        status !== 'connecting'
    ),
    tap(() => subjects.rtcRestart.next())
  )
