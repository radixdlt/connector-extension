import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { ScanQrCode } from './scan-qr'

test('should render get wallet link and QR code', async () => {
  const { container } = render(<ScanQrCode connectionPassword="abc" />)

  const getWalletLink: HTMLAnchorElement = screen.getByText(
    `Don't have Radix Wallet?`
  )
  const QrCode = container.querySelector('svg')

  expect(getWalletLink).not.toBeEmptyDOMElement()
  expect(getWalletLink.href).toBe('https://radixdlt.com/')

  expect(QrCode).not.toBeEmptyDOMElement()
})

test('should not render if connectionPassword is missing', async () => {
  render(<ScanQrCode connectionPassword={undefined} />)

  const getWalletLink = screen.queryByText(`Don't have Radix Wallet?`)
  expect(getWalletLink).not.toBeInTheDocument()
})
