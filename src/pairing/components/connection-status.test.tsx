import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

import { ConnectionStatus } from './connection-status'

test('should render forget wallet button', () => {
  const onForgetWalletSpy = jest.fn()
  render(
    <ConnectionStatus
      activeConnection={true}
      onForgetWallet={onForgetWalletSpy}
    />
  )

  const forgetWalletButton: HTMLAnchorElement = screen.getByText(
    'Forget this Radix Wallet'
  )

  fireEvent(
    forgetWalletButton,
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    })
  )

  expect(onForgetWalletSpy).toHaveBeenCalled()
})
