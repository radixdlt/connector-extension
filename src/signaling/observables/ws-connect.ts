import { withLatestFrom, tap } from 'rxjs'
import { SignalingSubjectsType } from 'signaling/subjects'

export const wsConnect = (
  subjects: SignalingSubjectsType,
  connect: (connectionId: string) => void
) =>
  subjects.wsConnectSubject.pipe(
    withLatestFrom(
      subjects.wsConnectionSecretsSubject,
      subjects.wsStatusSubject
    ),
    tap(([shouldConnect, secrets, status]) => {
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
