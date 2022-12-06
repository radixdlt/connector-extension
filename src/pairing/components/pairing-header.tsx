import { Header, Text } from '../../components'

type PairingHeaderProps = { header: string; children?: string }

export const PairingHeader = ({ header, children }: PairingHeaderProps) => (
  <>
    <Header mb="lg">{header}</Header>
    <Text color="radixGrey2" style={{ color: 'white', lineHeight: '23px' }}>
      {children}
    </Text>
  </>
)
