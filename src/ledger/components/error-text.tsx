import { Link, Text } from 'components'
import { MessagingContext } from 'ledger/contexts/messaging-context'
import { LedgerErrorCode } from 'ledger/wrapper/constants'
import { useContext } from 'react'

export const ErrorMessages: Record<string, string> = {
  [LedgerErrorCode.MultipleLedgerConnected]:
    'Please connect only one ledger device',
  [LedgerErrorCode.UnlockDevice]: 'Please unlock Ledger Device and try again',
  [LedgerErrorCode.BadIns]:
    'Please open Radix Babylon app in your Ledger device and try again',
  [LedgerErrorCode.NoDevicesConnected]:
    'Did not find any connected Ledger devices. Please connect your Ledger device and try again',
  [LedgerErrorCode.FailedToListLedgerDevices]:
    'Failed initial check to check list of connected devices',
  [LedgerErrorCode.FailedToCreateTransport]:
    'Could not recognize Ledger device. Did you connect it to your computer and unlock it?',
  [LedgerErrorCode.FailedToExchangeData]:
    'Failed to exchange data with Ledger device. Please restart Babylon Ledger app and try again',
  [LedgerErrorCode.DeviceMismatch]: `Connected device doesn't match requested one. Make sure you connected correct Ledger device`,
}

export const ErrorText = ({ error }: { error?: string }) => {
  const errorNames = Object.fromEntries(
    Object.entries(LedgerErrorCode).map(([key, value]) => [value, key]),
  )
  const { switchToFullWindow } = useContext(MessagingContext)
  const url = new URL(window.location.href)
  const isPopupWindow = url.searchParams.get('isPopupWindow') === 'true'
  return error ? (
    <>
      <Text
        bold
        style={{ color: 'white', lineHeight: '23px', marginTop: '20px' }}
      >
        {ErrorMessages[error]
          ? ErrorMessages[error]
          : `Unknown error: ${errorNames[error] || error}`}
      </Text>
      {error === LedgerErrorCode.FailedToCreateTransport && isPopupWindow ? (
        <Text style={{ color: 'white', marginTop: '20px' }} italic>
          If you are connecting Ledger device for the first time, please&nbsp;
          <Link
            href="#"
            onClick={switchToFullWindow}
            style={{ textDecoration: 'underline' }}
          >
            navigate to full window
          </Link>{' '}
          and try again
        </Text>
      ) : null}
    </>
  ) : null
}
