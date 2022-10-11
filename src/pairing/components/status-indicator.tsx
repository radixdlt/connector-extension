import { Text } from '../../components'

type StatusIndicatorProps = { children: string[]; active: boolean }

export const StatusIndicator = ({ children, active }: StatusIndicatorProps) => (
  <>
    <svg
      style={{ alignSelf: 'center', marginRight: 8 }}
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="4.5" cy="4.5" r="4.5" fill={active ? '#00FF0A' : 'red'} />
    </svg>

    <Text size="xSmall" medium>
      {children}
    </Text>
  </>
)
