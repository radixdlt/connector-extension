import { Modal, Text, Box, Button } from 'components'

export const ForgetThisWallet = (props: {
  forgetWallet: () => void
  cancel: () => void
}) => {
  return (
    <Modal header="Forget This Wallet">
      <Text
        style={{
          color: '#8A8FA4',
          margin: '16px 0',
          fontSize: '14px',
          textAlign: 'center',
        }}
      >
        Are you sure you want to forget this wallet?
      </Text>
      <Box items="center" style={{ gap: '8px' }}>
        <Button secondary onClick={() => props.cancel()}>
          Cancel
        </Button>
        <Button onClick={() => props.forgetWallet()} full>
          Forget
        </Button>
      </Box>
    </Modal>
  )
}
