import { ConnectorSubscriptionsInput } from 'connector/_types'
import { delay, tap } from 'rxjs'

export const regenerateConnectionPassword = (
  input: ConnectorSubscriptionsInput
) =>
  input.signalingServerClient.subjects.wsRegenerateConnectionPassword.pipe(
    tap(() => {
      input.storageClient.subjects.removeConnectionPasswordSubject.next()
      input.webRtcClient.subjects.rtcRestartSubject.next()
    }),
    delay(0),
    tap(() =>
      input.signalingServerClient.subjects.wsGenerateConnectionSecretsSubject.next()
    )
  )
