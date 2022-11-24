import { filter, withLatestFrom, tap } from 'rxjs'
import { ConnectorSubscriptionsInput } from 'connector/_types'

export const storeConnectionPassword = (input: ConnectorSubscriptionsInput) =>
  input.webRtcClient.subjects.rtcStatusSubject.pipe(
    filter((status) => status === 'connected'),
    withLatestFrom(
      input.signalingServerClient.subjects.wsConnectionSecretsSubject
    ),
    tap(([, secretsResult]) =>
      secretsResult?.map((secrets) =>
        input.storageClient.subjects.addConnectionPasswordSubject.next(
          secrets.encryptionKey
        )
      )
    )
  )
