import { Account as AccountType } from '@radixdlt/radix-dapp-toolkit'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'radix-account': {
        label: string
        address: string
        appearanceId: number
      }
    }
  }
}

export const Account = ({ account }: { account: AccountType }) => {
  return (
    <radix-account
      label={account.label}
      address={account.address}
      appearanceId={account.appearanceId}
    ></radix-account>
  )
}
