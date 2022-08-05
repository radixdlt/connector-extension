import Button from 'components/button'
import Clipboard from 'components/clipboard'
import QRCode from 'react-qr-code'
import { useConnectionSecrets } from 'hooks/use-connection-secrets'
import { useOverlayClipboard } from 'hooks'

type EncryptionKeyProps = {
  onNext: () => void
}

export const EncryptionKey = ({ onNext }: EncryptionKeyProps) => {
  const secretsResult = useConnectionSecrets()
  const secrets = secretsResult?.isOk() ? secretsResult.value : undefined
  const password = secrets?.passwordBech32 || ''

  const QR = useOverlayClipboard(
    <QRCode size={170} value={password} />,
    password
  )
  const Password = useOverlayClipboard(
    <Clipboard value={password} />,
    password,
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
