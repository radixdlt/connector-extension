import { SubjectsType } from 'connections/subjects'
import { combineLatest, withLatestFrom, tap } from 'rxjs'

export const wsConnect = (
  subjects: SubjectsType,
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
