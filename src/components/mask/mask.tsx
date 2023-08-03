import { Box, Text } from 'components'
import { PropsWithChildren } from 'react'

export const Mask = (props: PropsWithChildren<unknown>) => {
  return (
    <Box
      mt="4xl"
      bg="white"
      radius="medium"
      p="large"
      position="relative"
      textAlign="center"
      maxWidth="medium"
    >
      <Box
        position="absolute"
        style={{
          left: 0,
          right: 0,
        }}
      >
        <img
          src="/radix-icon_128x128.png"
          style={{
            width: '78px',
            height: '78px',
            transform: 'translateY(-66px)',
            boxShadow: '0 4px 10px 0 rgba(0, 0, 0, 0.25)',
            borderRadius: '16px',
          }}
        />
      </Box>

      <Text size="large" color="radixGrey2" mt="xl">
        Radix Wallet Connector
      </Text>
      {props.children}
    </Box>
  )
}
