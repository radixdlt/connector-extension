import { useHover, useCopyToClipboard } from 'react-use'
import Overlay from 'components/overlay'
import Text from 'components/text'
import Box from 'components/box'
import React from 'react'

const useOverlayClipboard = (
  childElement: React.ReactElement,
  copyString: string,
  small = false
) => {
  const [state, copyToClipboard] = useCopyToClipboard()
  const element = (hovered: boolean) => (
    <Box
      onClick={() => copyToClipboard(copyString)}
      pointer
      position="relative"
      px="none"
      py="small"
      justify="center"
    >
      <Overlay show={hovered} />
      {hovered && (
        <Text
          size={small ? 'small' : 'medium'}
          css={{
            color: '$grey',
            position: 'absolute',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          {state.value && !state.error ? 'Copied!' : 'Click to copy'}
        </Text>
      )}
      {childElement}
    </Box>
  )
  const [hoverable] = useHover(element)
  return hoverable
}

export default useOverlayClipboard