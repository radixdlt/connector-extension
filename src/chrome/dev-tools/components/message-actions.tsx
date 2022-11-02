import { Box, Button } from 'components'
import { useConnector } from 'hooks/use-connector'
import { createMockResponse } from '../helpers/create-mock-response'

export const MessageActions = ({
  message,
  clearMessage,
}: {
  message: any
  clearMessage: () => void
}) => {
  const connector = useConnector()

  const onReject = () => {
    connector?.sendMessage({
      error: 'rejectedByUser',
      message: 'user rejected request',
      requestId: message.requestId,
    })
    clearMessage()
  }
  const onApprove = async () => {
    const response = await createMockResponse(message)
    connector?.sendMessage(response)
    clearMessage()
  }

  return (
    <Box>
      <Box flex="row">
        <Button full size="small" onClick={onReject}>
          Reject
        </Button>
        <Button full size="small" onClick={onApprove}>
          Approve
        </Button>
      </Box>
    </Box>
  )
}
