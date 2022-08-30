import { combineLatest, withLatestFrom, tap } from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'

export const connect = (
  subjects: SignalingSubjectsType,
  connect: (connectionId: string) => void
) =>
  combineLatest([
    subjects.wsConnectSubject,
    subjects.wsConnectionSecretsSubject,
  ]).pipe(
    withLatestFrom(subjects.wsStatusSubject),
    tap(([[shouldConnect, secrets], status]) => {
      if (
        status === 'disconnected' &&
        shouldConnect &&
        secrets &&
        secrets.isOk()
      ) {
        connect(secrets.value.connectionId.toString('hex'))
      }
    })
  )
