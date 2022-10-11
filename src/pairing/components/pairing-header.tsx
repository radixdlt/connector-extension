import { Header, Text } from '../../components'

type PairingHeaderProps = { header: string; children: string }

export const PairingHeader = ({ header, children }: PairingHeaderProps) => (
  <>
    <Header mb="lg">{header}</Header>
    <Text size="xSmall" color="radixGrey2" style={{ lineHeight: '15.6px' }}>
      {children}
    </Text>
  </>
)
