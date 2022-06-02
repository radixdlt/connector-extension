import { styled } from './stitches.config'

const Button = styled('button', {
  backgroundColor: 'gainsboro',
  borderRadius: '9999px',
  fontSize: '$xl',
  padding: '$md $xl',
  '&:hover': {
    backgroundColor: 'lightgray',
  },
})

function App() {
  return (
    <div>
      <Button>hello</Button>
    </div>
  )
}

export default App
