import { ConnectorSubscriptionsInput } from 'connector/_types'
import { tap } from 'rxjs'

export const pairingState = (input: ConnectorSubscriptionsInput) =>
  input.storageClient.subjects.onPasswordChange.pipe(
    tap(() =>
      input.storageClient
        .getConnectionPassword()
        .map((connectionPassword) =>
          input.connectorSubjects.pairingStateSubject.next(
            connectionPassword ? 'paired' : 'notPaired'
          )
        )
    )
  )
