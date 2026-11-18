import type { Account as AccountType } from '@radixdlt/radix-dapp-toolkit'
import { Account } from 'components/account/account'
import { useId, useState } from 'react'
import { accountExplorerUrl } from 'utils/explorer'
import { ExpandMoreIcon, WalletIcon } from 'ui/icons'
import { Collapse } from 'ui/collapse'

export const SharedAccounts = (props: {
  accounts?: AccountType[]
  isJustLinked?: boolean
}) => {
  const [isCollapsed, setIsCollapsed] = useState(!props.isJustLinked)
  const listId = useId()

  const onLinkClick = async (e: CustomEvent) => {
    if (e.detail.type === 'account' && e.detail.data)
      window.open(accountExplorerUrl(e.detail.data), '_blank')
  }

  const count = props.accounts?.length ?? 0
  if (!count)
    return (
      <p className="linked-wallet__accounts linked-wallet__accounts--none">
        <WalletIcon />
        No shared accounts
      </p>
    )

  return (
    <div className="linked-wallet__accounts">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`linked-wallet__accounts-toggle${
          isCollapsed ? '' : ' linked-wallet__accounts-toggle--open'
        }`}
        aria-expanded={!isCollapsed}
        aria-controls={listId}
      >
        <WalletIcon />
        <span className="linked-wallet__accounts-count">
          {count} shared account{count === 1 ? '' : 's'}
        </span>
        <span className="linked-wallet__accounts-action">
          {isCollapsed ? 'Show' : 'Hide'}
          <ExpandMoreIcon />
        </span>
      </button>
      <Collapse open={!isCollapsed}>
        <div className="shared-accounts" id={listId}>
          {props.accounts?.map((account) => (
            <Account
              key={account.address}
              account={account}
              onLinkClick={onLinkClick}
            />
          ))}
        </div>
      </Collapse>
    </div>
  )
}
