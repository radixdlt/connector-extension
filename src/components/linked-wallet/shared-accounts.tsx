import { Button } from 'components/button'
import ChevronDown from './chevron-down.svg'
import { Account as AccountType } from '@radixdlt/radix-connect-schemas'
import { Account } from 'components/account/account'
import { Box, Collapse } from '@mui/material'
import { useState } from 'react'
import { Spinner } from 'components/spinner/spinner'

export const SharedAccounts = (props: {
  accounts?: AccountType[]
  pendingAccountRequest?: boolean | undefined
  onRequestAccountList: () => void
}) => {
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
        ) : (
          <Button
            secondary
            full
            onClick={props.onRequestAccountList}
            disabled={props.pendingAccountRequest}
          >
            {props.pendingAccountRequest ? <Spinner /> : 'Request Account List'}
          </Button>
        )}
      </Box>
    </Box>
  )
}
