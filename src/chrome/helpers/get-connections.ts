import { Connections } from 'pairing/state/connections'
import { chromeLocalStore } from './chrome-local-store'
import { ResultAsync } from 'neverthrow'

export const getConnections = (): ResultAsync<Connections, Error> =>
  chromeLocalStore
    .getItem('connections')
    .map(({ connections }) => connections || {})

export const hasConnections = () =>
  getConnections().map(
    (connections) => Object.keys(connections || {}).length > 0,
  )
