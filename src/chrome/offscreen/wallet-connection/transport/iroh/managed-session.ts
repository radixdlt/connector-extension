import type { AppLogger } from 'utils/logger'
import {
  getIrohErrorCode,
  type IrohSession,
  type IrohSessionEvent,
} from './iroh-bindings'
import { settleWithin } from './settle'

/**
 * Wraps one `IrohSession`. Shutting it down takes at most `shutdownTimeoutMs`, and
 * once that is over `nextEvent` returns `undefined` even if the wasm call is still
 * pending: a session that does not close in time cannot keep the next one from
 * starting.
 */
export const ManagedSession = (
  session: IrohSession,
  options: { shutdownTimeoutMs: number; logger?: AppLogger },
) => {
  const onShutdown = new Set<() => void>()
  let shuttingDown: Promise<void> | undefined
  let isShutDown = false

  const call = <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return fn()
    } catch (error) {
      return Promise.reject(error)
    }
  }

  const nextEvent = () =>
    new Promise<IrohSessionEvent | undefined>((resolve, reject) => {
      if (isShutDown) {
        resolve(undefined)
        return
      }
      const stop = () => resolve(undefined)
      onShutdown.add(stop)
      call(() => session.nextEvent()).then(
        (event) => {
          onShutdown.delete(stop)
          resolve(event)
        },
        (error) => {
          onShutdown.delete(stop)
          reject(error)
        },
      )
    })

  const shutdown = () => {
    if (!shuttingDown) {
      const closing = call(() => session.shutdown()).catch((error) => {
        options.logger?.warn('iroh: shutting the session down failed', {
          code: getIrohErrorCode(error),
        })
      })
      shuttingDown = settleWithin(closing, options.shutdownTimeoutMs).then(
        () => {
          isShutDown = true
          onShutdown.forEach((stop) => stop())
          onShutdown.clear()
        },
      )
    }
    return shuttingDown
  }

  /**
   * Shuts the session down, then frees the wasm object. Calls still pending keep
   * their own reference to the Rust session, so freeing does not affect them.
   */
  const close = async () => {
    await shutdown()
    try {
      session.free()
    } catch (error) {
      options.logger?.warn('iroh: freeing the session failed')
    }
  }

  return {
    isConnected: () => {
      try {
        return session.state() === 'connected'
      } catch (error) {
        return false
      }
    },
    send: (message: string) => call(() => session.send(message)),
    supportsNetworkChanged: () => typeof session.networkChanged === 'function',
    networkChanged: () =>
      isShutDown
        ? Promise.resolve()
        : call(() => session.networkChanged?.() ?? Promise.resolve()),
    /** The relay the wallet is on, or `undefined` (unknown, or not supported). */
    peerRelay: (): Promise<string | undefined> =>
      isShutDown || typeof session.peerRelay !== 'function'
        ? Promise.resolve(undefined)
        : call(() => session.peerRelay!()).catch(() => undefined),
    /** Whether the wallet reports its requests; `false` with a library that predates it. */
    peerReportsRequests: (): boolean => {
      try {
        return !isShutDown && typeof session.peerReportsRequests === 'function'
          ? session.peerReportsRequests!()
          : false
      } catch (error) {
        return false
      }
    },
    /** Forgets a cancelled request; nothing with a library that predates it. */
    forgetRequest: (interactionId: string): void => {
      try {
        if (!isShutDown && typeof session.forgetRequest === 'function')
          session.forgetRequest(interactionId)
      } catch (error) {
        // A session freed meanwhile has nothing to forget.
      }
    },
    /** `undefined` once freed. */
    diagnostics: () => {
      try {
        return session.diagnostics()
      } catch (error) {
        return undefined
      }
    },
    nextEvent,
    shutdown,
    close,
  }
}

export type ManagedSession = ReturnType<typeof ManagedSession>
