import { Box } from 'components'
import Dots from './dots.svg'
import './linked-wallet.scss'
import * as React from 'react'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { SharedAccounts } from './shared-accounts'
import { Account } from '@radixdlt/radix-dapp-toolkit'

export const LinkedWallet = ({
  name,
  accounts,
  onRenameWalletLink,
  onForgetWallet,
}: {
  name: string
  accounts: Account[]
  onRenameWalletLink: () => void
  onForgetWallet: () => void
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const open = Boolean(anchorEl)
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }
  const handleClose = () => {
    setAnchorEl(null)
  }

  const renameWalletLink = () => {
    onRenameWalletLink()
    handleClose()
  }

  const forgetWallet = () => {
    onForgetWallet()
    handleClose()
  }
  const menuItemSx = {
    padding: '12px 22px 11px',
    fontWeight: '500',
    fontSize: '15px',
    fontFamily: 'IBM Plex Sans',
  }

  return (
    <Box
      className="linked-wallet"
      bg="white"
      style={{
        borderRadius: '16px',
        boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)',
        padding: '8px 16px',
      }}
    >
      <Box
        style={{
          padding: '16px 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            color: 'var(--color-radix-grey-1)',
            fontSize: '18px',
            fontStyle: 'normal',
            fontWeight: 600,
          }}
        >
          {name}
        </span>

        <button style={{ display: 'flex' }} onClick={handleClick}>
          <img src={Dots} />
        </button>
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          onClick={handleClose}
          slotProps={{
            paper: {
              sx: {
                overflow: 'visible',
                borderRadius: '16px',
                background: '#003057',
                color: '#fff',
                mt: 1.5,
                '&:before': {
                  content: '""',
                  display: 'block',
                  position: 'absolute',
                  top: 2,
                  right: 21,
                  width: 15,
                  height: 15,
                  background: '#003057',
                  transform: 'translateY(-50%) rotate(45deg)',
                  zIndex: 0,
                },
              },
            },
          }}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem sx={menuItemSx} onClick={renameWalletLink}>
            Rename Wallet Link
          </MenuItem>
          <MenuItem sx={menuItemSx} onClick={forgetWallet}>
            Forget Wallet
          </MenuItem>
        </Menu>
      </Box>
      <SharedAccounts accounts={accounts} />
    </Box>
  )
}
