import { useEffect, useState } from 'react'
import {
  type ConnectorExtensionOptions,
  defaultConnectorExtensionOptions,
  getExtensionOptions,
  updateExtensionOptions,
} from 'options'
import {
  parseIrohRelayUrl,
  parseRadixConnectTransport,
} from 'options/radix-connect-transport'
import { loadIroh } from 'chrome/offscreen/wallet-connection/transport/iroh/load-iroh'

/**
 * The extension's options and how to change them: each change is saved at once,
 * except the iroh relay, saved when its field is left (every change restarts the
 * iroh sessions) and only if valid.
 */
// The options as last read or changed in this page: settings screens opened again
// show them at once, and nothing moves while they are read again.
let lastKnownOptions: ConnectionOptions | undefined

type ConnectionOptions = Omit<
  ConnectorExtensionOptions,
  'publicKey' | 'privateKey'
>

export const useExtensionOptions = () => {
  // Unknown (undefined) until read, the first time in this page.
  const [knownOptions, setKnownOptions] = useState(lastKnownOptions)
  const options = knownOptions ?? defaultConnectorExtensionOptions
  const setOptions = (
    next: (current: ConnectionOptions) => ConnectionOptions,
  ) =>
    setKnownOptions((current) => {
      lastKnownOptions = next(current ?? defaultConnectorExtensionOptions)
      return lastKnownOptions
    })
  const [irohRelayUrlDraft, setIrohRelayUrlDraft] = useState('')
  // Reason the iroh library gives for not accepting the relay URL.
  const [irohRelayUrlRejection, setIrohRelayUrlRejection] = useState<string>()

  useEffect(() => {
    getExtensionOptions().map((stored) => {
      setOptions(() => stored)
      setIrohRelayUrlDraft(stored.irohRelayUrl ?? '')
    })
  }, [])

  // Only the changes are saved, on top of the saved options: the defaults shown
  // before those are read never overwrite them.
  const update = (changes: Partial<ConnectorExtensionOptions>) => {
    setOptions((current) => ({ ...current, ...changes }))
    updateExtensionOptions(changes)
  }

  const irohRelayUrl = parseIrohRelayUrl(irohRelayUrlDraft)

  const saveIrohRelayUrl = () => {
    if (irohRelayUrl.isErr()) return
    const normalized = irohRelayUrl.value ?? ''
    setIrohRelayUrlDraft(normalized)
    if (normalized === (options.irohRelayUrl ?? '')) return
    const save = () => update({ irohRelayUrl: normalized })
    if (!normalized) return save()
    // On top of the extension's rules, the URL must be one the library can use.
    // Should the module not load here, sessions still refuse an unusable URL.
    loadIroh()
      .map((iroh) => iroh.validateRelayUrl(normalized))
      .match(
        (rejection) => {
          setIrohRelayUrlRejection(rejection)
          if (!rejection) save()
        },
        () => save(),
      )
  }

  return {
    options,
    /** Whether `options` were read (else they are the defaults). */
    loaded: knownOptions !== undefined,
    radixConnectTransport: parseRadixConnectTransport(
      options.radixConnectTransport,
    ),
    update,
    irohRelayUrlDraft,
    irohRelayUrlError: irohRelayUrl.isErr()
      ? irohRelayUrl.error
      : irohRelayUrlRejection,
    setIrohRelayUrlDraft: (value: string) => {
      setIrohRelayUrlDraft(value)
      setIrohRelayUrlRejection(undefined)
    },
    saveIrohRelayUrl,
  }
}
