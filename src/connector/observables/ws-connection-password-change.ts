import { ConnectorSubscriptionsInput } from 'connector/_types'
import { tap } from 'rxjs'

export const wsConnectionPasswordChange = (
  input: ConnectorSubscriptionsInput
) =>
  input.storageClient.subjects.onPasswordChange.pipe(
    tap((buffer) =>
      input.signalingServerClient.subjects.wsConnectionPasswordSubject.next(
        buffer
      )
    )
  )
