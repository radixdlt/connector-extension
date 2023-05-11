import { Link, Text } from 'components'
import { MessagingContext } from 'ledger/contexts/messaging-context'
import { LedgerErrorResponse, errorResponses } from 'ledger/wrapper/constants'
import { isKnownError } from 'ledger/wrapper/utils'
import { useContext } from 'react'

export const ErrorText = ({ error }: { error?: string }) => {
  const { switchToFullWindow } = useContext(MessagingContext)
  const url = new URL(window.location.href)
  const isPopupWindow = url.searchParams.get('isPopupWindow') === 'true'
  return error ? (
    <>
      <Text
        bold
        style={{ color: 'white', lineHeight: '23px', marginTop: '20px' }}
      >
        {isKnownError(error)
          ? errorResponses[error]
          : `Unknown error: ${error}`}
      </Text>
      {error === LedgerErrorResponse.FailedToCreateTransport &&
      isPopupWindow ? (
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
