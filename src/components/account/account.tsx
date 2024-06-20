import { Account as AccountType } from '@radixdlt/radix-dapp-toolkit'
import { RefObject, createRef, useEffect } from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'radix-account': {
        ref: RefObject<HTMLElement>
        label: string
        address: string
        appearanceId: number
      }
    }
  }
}

export const Account = ({
  account,
  onLinkClick,
}: {
  account: AccountType
  onLinkClick?: (ev: CustomEvent) => void
}) => {
  const ref = createRef<HTMLElement>()

  useEffect(() => {
    if (!ref.current || !onLinkClick) return

    ref.current.addEventListener('onLinkClick', onLinkClick as EventListener)

    return () => {
      if (!ref.current || !onLinkClick) return
      ref.current.removeEventListener(
        'onLinkClick',
        onLinkClick as EventListener,
      )
    }
  }, [])
  return (
    <radix-account
      ref={ref}
      label={account.label}
      address={account.address}
      appearanceId={account.appearanceId}
    ></radix-account>
  )
}
