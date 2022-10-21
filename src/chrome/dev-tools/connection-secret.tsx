import { ConnectorContext } from 'contexts/connector-context'
import { useContext, useState } from 'react'
import { Box, Button } from 'components'

export const ConnectionSecret = () => {
  const connector = useContext(ConnectorContext)
  const [text, setText] = useState<string>('')

  const onSubmit = () => {
    connector?.setConnectionPassword(text)
    setText('')
  }

  return (
    <Box style={{ width: '500px' }}>
      <Box>
        <input
          style={{ width: '100%', boxSizing: 'border-box' }}
          onChange={(ev) => setText(ev.target.value)}
          value={text}
        />
      </Box>

      <Button full size="small" type="submit" onClick={() => onSubmit()}>
        Set connection password
      </Button>
    </Box>
  )
}
