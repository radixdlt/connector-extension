import { ConnectorType } from 'connector/connector'
import { createContext } from 'react'

export const ConnectorContext = createContext<ConnectorType | null>(null)
