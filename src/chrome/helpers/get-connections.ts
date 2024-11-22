import { Connections } from 'pairing/state/connections'
import { chromeLocalStore } from './chrome-local-store'
import { ResultAsync, ok } from 'neverthrow'

export const getConnections = (): ResultAsync<Connections, never> =>
  chromeLocalStore
    .getItem('connections')
    .map(({ connections }) => connections || {})
    .orElse(() => ok({}))

export const hasConnections = () =>
  getConnections().map(
    (connections) => Object.keys(connections || {}).length > 0,
  )

export type HasConnections = typeof hasConnections
