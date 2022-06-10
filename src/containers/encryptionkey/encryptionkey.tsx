import Button from 'components/button'
import Clipboard from 'components/clipboard'
import QRCode from 'react-qr-code'
import { useOverlayClipboard } from 'hooks'

interface EncryptionkeyProps {
  onNext: () => void
}

const Encryptionkey = ({ onNext }: EncryptionkeyProps) => {
  const QR = useOverlayClipboard(
    <QRCode size={170} value="z4ncptue" />,
    'z4ncptue'
  )
  const Password = useOverlayClipboard(
    <Clipboard value="e565c7765192b7eeeaf8b1937d5321feaeb74cf51bdc9ba09d55ad806ee56b22" />,
    'e565c7765192b7eeeaf8b1937d5321feaeb74cf51bdc9ba09d55ad806ee56b22',
    true
  )
  return (
    <>
      {QR}
      {Password}
      <Button full onClick={onNext} size="small">
        Connect
      </Button>
    </>
  )
}

export default Encryptionkey
