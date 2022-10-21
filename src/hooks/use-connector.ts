import { ConnectorContext } from 'contexts/connector-context'
import { useContext } from 'react'

export const useConnector = () => {
  const connector = useContext(ConnectorContext)
  return connector
}
