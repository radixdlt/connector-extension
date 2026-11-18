import type { Connections } from 'pairing/state/connections'
import { localStore } from './storage'
import type { ResultAsync } from 'neverthrow'
import { ok } from 'neverthrow'

export const getConnections = (): ResultAsync<Connections, never> =>
  localStore
    .get('connections')
    .map((connections) => connections || {})
    .orElse(() => ok({}))

export const hasConnections = () =>
  getConnections().map(
    (connections) => Object.keys(connections || {}).length > 0,
  )

export type HasConnections = typeof hasConnections
