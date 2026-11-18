import { ResultAsync } from 'neverthrow'
import { isDevMode, isIrohAvailable } from 'config'
import { logger as appLogger } from 'utils/logger'
import { errorIdentity } from 'utils/error-identity'
import type { IrohBindings, IrohLogLevel } from './iroh-bindings'
import { createIrohLogForwarder } from './iroh-library-log'

// The library's own lifecycle lines (session started, relay, peer connected or
// gone and why) and the warnings and errors of iroh's internals in every build; iroh's
// internals in more detail in builds with dev tools. The library logs connection
// events and short endpoint ids, never passwords or message contents; the forwarder
// masks IP addresses (see `createIrohLogForwarder`).
const maxLogLevel: IrohLogLevel = isDevMode ? 'debug' : 'info'

const importAndInit = async (): Promise<IrohBindings> => {
  // Imported on demand: pages and users that only use WebRTC never fetch the wasm.
  const [bindings, wasm] = await Promise.all([
    import('@genkipool/radix-connect-iroh'),
    import('@genkipool/radix-connect-iroh/radix_connect_iroh_bg.wasm?url'),
  ])
  // Instantiating WebAssembly needs 'wasm-unsafe-eval' in the extension pages CSP
  // (see vite.config.ts). The module is fetched from the extension's own origin.
  await bindings.default({ module_or_path: wasm.default })
  // tslog copies a logger's transports into each sub-logger it creates: create this
  // one when iroh is first loaded, after the page attached its own transports (the
  // offscreen document's feeds "Export Logs"), not when this file is imported.
  bindings.setLogger(
    createIrohLogForwarder({
      logger: appLogger.getSubLogger({ name: 'iroh' }),
    }),
    maxLogLevel,
  )
  return {
    startSession: (...args) => bindings.IrohSession.start(...args),
    publicRelayUrls: () => bindings.publicRelayUrls(),
    validateRelayUrl: (relayUrl) => bindings.validateRelayUrl(relayUrl),
  }
}

// Builds without iroh bundle a stub in place of the package (see vite.config.ts).
const load = isIrohAvailable
  ? importAndInit
  : () => Promise.reject(new Error('this build does not include iroh'))

let loading: Promise<IrohBindings> | undefined

/** Loads and initializes the iroh wasm module, once per page. */
export const loadIroh = (): ResultAsync<IrohBindings, Error> => {
  if (!loading) {
    loading = load().catch((error) => {
      // Let a later call try again (e.g. after a failed fetch).
      loading = undefined
      throw error
    })
  }
  return ResultAsync.fromPromise(loading, errorIdentity)
}
