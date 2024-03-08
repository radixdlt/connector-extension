import { Subject } from 'rxjs'

export type SyncClient = ReturnType<typeof SyncClient>

export const SyncClient = () => {
  const walletConfirmedInteractionId = new Subject<string>()
  const walletRespondedForInteractionId = new Subject<string>()

  return {
    addConfirmedInteractionId: (interactionId: string) => {
      walletConfirmedInteractionId.next(interactionId)
    },
    addResponseForInteractionId: (interactionId: string) => {
      walletRespondedForInteractionId.next(interactionId)
    },
    dappRequestConfirmedByWallet$: walletConfirmedInteractionId.asObservable(),
    dappRequestResponseFromWallet$:
      walletRespondedForInteractionId.asObservable(),
  }
}

export const syncClient = SyncClient()
