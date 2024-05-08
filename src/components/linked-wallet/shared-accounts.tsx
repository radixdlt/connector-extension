import ChevronDown from './chevron-down.svg'
import { Account as AccountType } from '@radixdlt/radix-dapp-toolkit'
import { Account } from 'components/account/account'
import { Box, Collapse } from '@mui/material'
import { useState } from 'react'

export const SharedAccounts = (props: { accounts?: AccountType[] }) => {
  const [isCollapsed, setIsCollapsed] = useState(true)

  return (
    <Box sx={{ marginTop: '-5px', marginBottom: '5px' }}>
      <Collapse in={!isCollapsed}>
        <Box display="flex" flexDirection="column" gap="8px">
          {props.accounts?.map((account) => (
            <Account key={account.address} account={account} />
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
