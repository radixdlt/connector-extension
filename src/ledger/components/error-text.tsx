import { Text } from 'components'

export const ErrorText = ({ error }: { error?: string }) =>
  error ? (
    <Text
      bold
      style={{ color: 'white', lineHeight: '23px', marginTop: '20px' }}
    >
      {error}
    </Text>
  ) : (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <></>
  )
