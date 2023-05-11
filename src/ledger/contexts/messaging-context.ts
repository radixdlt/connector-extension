import { LedgerResponse } from 'ledger/schemas'
import { createContext } from 'react'

export const MessagingContext = createContext<{
  respond: (response: LedgerResponse) => void
  switchToFullWindow: () => void
}>({
  respond: () => new Error('MessagingContext not initialized'),
  switchToFullWindow: () => new Error('MessagingContext not initialized'),
})
