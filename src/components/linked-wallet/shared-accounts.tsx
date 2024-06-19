import ChevronDown from './chevron-down.svg'
import {
  Account as AccountType,
  RadixNetworkConfigById,
} from '@radixdlt/radix-dapp-toolkit'
import { Account } from 'components/account/account'
import { Box, Collapse } from '@mui/material'
import { useState } from 'react'
import { parseAddress } from 'utils/parse-address'

export const SharedAccounts = (props: {
  accounts?: AccountType[]
  isJustLinked?: boolean
}) => {
  const [isCollapsed, setIsCollapsed] = useState(!props.isJustLinked)

  const onLinkClick = async (e: CustomEvent) => {
    if (e.detail.type === 'account' && e.detail.data) {
      const { networkId } = parseAddress(e.detail.data)
      const dashboardUrl = RadixNetworkConfigById[networkId].dashboardUrl

      window.open([dashboardUrl, 'account', e.detail.data].join('/'), '_blank')
    }
  }

  return (
    <Box>
      <Collapse in={!isCollapsed}>
        <Box display="flex" flexDirection="column" gap="8px">
          {props.accounts?.map((account) => (
            <Account
              key={account.address}
              account={account}
              onLinkClick={onLinkClick}
            />
          ))}
        </Box>
      </Collapse>

      <Box display="flex" alignItems="center" justifyContent="center">
        {props.accounts?.length ? (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={
              (!isCollapsed ? 'rotate' : '') +
              ' shared-accounts-collapse-button'
            }
          >
            <img src={ChevronDown} />
          </button>
        ) : null}
      </Box>
    </Box>
  )
}
