import Button from 'components/button'
import QRCode from 'react-qr-code'

function Main() {
  return (
    <div>
      <QRCode size={150} value="z4ncptue" />
      <Button>Connect</Button>
    </div>
  )
}

export default Main
