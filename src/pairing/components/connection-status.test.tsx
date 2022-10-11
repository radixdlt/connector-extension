import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

import { ConnectionStatus } from './connection-status'

test('should render inactive connection state', () => {
  render(
    <ConnectionStatus activeConnection={false} onForgetWallet={() => {}} />
  )

  const connectionStatus: HTMLAnchorElement =
    screen.getByText(`Connection inactive`)

  expect(connectionStatus).not.toBeEmptyDOMElement()
})

test('should render active connection state', () => {
  render(<ConnectionStatus activeConnection={true} onForgetWallet={() => {}} />)

  const connectionStatus: HTMLAnchorElement =
    screen.getByText(`Connection active`)

  expect(connectionStatus).not.toBeEmptyDOMElement()
})

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
