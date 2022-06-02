import { styled } from './stitches.config'

const Button = styled('button', {
  backgroundColor: '$gray500',
  borderRadius: '$md',
  fontSize: '$xl',
  padding: '$md $xl',
  '&:hover': {
    backgroundColor: '$gray400',
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
