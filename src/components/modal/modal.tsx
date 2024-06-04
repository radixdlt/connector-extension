import { Box, Button, Text } from '..'
import { PropsWithChildren } from 'react'

export const Modal = (
  props: PropsWithChildren<{
    header: string
  }>,
) => {
  return (
    <Box
      position="absolute"
      bg="dark"
      style={{ margin: '-17px -32px', height: '100vh' }}
      full
      items="center"
      justify="center"
    >
      <Box
        flex="col"
        bg="white"
        p="medium"
        style={{
          borderRadius: '16px',
          maxWidth: '75vw',
          minWidth: '300px',
        }}
      >
        <Text
          mt="md"
          style={{
            color: '#003057',
            fontSize: '18px',
            fontWeight: '600',
            textAlign: 'center',
            marginTop: '10px',
          }}
        >
          {props.header}
        </Text>
        {props.children}
      </Box>
    </Box>
  )
}
