import ButtonC from './button'
import Icon from '../icon'

export const Button = () => (
  <>
    <h3>Small</h3>
    <ButtonC size="small">Buy Radix</ButtonC>
    <h3>Large</h3>
    <ButtonC>Buy Radix</ButtonC>
    <h3>Ghost</h3>
    <ButtonC ghost>Buy Radix</ButtonC>
    <h3>With icon</h3>
    <ButtonC size="iconSmall">
      <Icon size="small" type="refresh" />
    </ButtonC>
  </>
)
