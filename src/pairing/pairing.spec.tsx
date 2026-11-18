import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { MemoryRouter } from 'react-router-dom'
import { BehaviorSubject, Subject } from 'rxjs'
import { okAsync } from 'neverthrow'
import { ed25519 } from '@noble/curves/ed25519'
import { defaultConnectorExtensionOptions } from 'options'
import { Pairing } from './pairing'

const webRtc = vi.hoisted(() => ({ generatedPasswords: 0 }))

vi.mock(
  'chrome/offscreen/wallet-connection/transport/webrtc-transport',
  () => ({
    createWebRtcTransport: () => {
      const connectionPassword = new BehaviorSubject<Buffer | undefined>(
        undefined,
      )
      return {
        connected$: new BehaviorSubject(false).asObservable(),
        onMessage$: new Subject().asObservable(),
        connectionPassword$: connectionPassword.asObservable(),
        generateConnectionPassword: () => {
          webRtc.generatedPasswords += 1
          // The app's Buffer (buffer-shim), as the real client returns.
          const password = Buffer.from(
            crypto.getRandomValues(new Uint8Array(32)),
          )
          connectionPassword.next(password)
          return okAsync(password)
        },
        setConnectionPassword: () => okAsync(undefined),
        setConnectionConfig: () => undefined,
        sendMessage: () => okAsync(undefined),
        connect: () => undefined,
        disconnect: () => undefined,
        restart: () => undefined,
        destroy: () => undefined,
      }
    },
  }),
)

vi.mock('./components/connection-password', () => ({
  ConnectionPassword: ({
    connectionPassword,
  }: {
    connectionPassword?: string
  }) => <span data-testid="password">{connectionPassword}</span>,
}))

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const storageChange = async (key: string, newValue: unknown) =>
  act(async () => {
    // @ts-expect-error vitest-chrome events can be triggered from tests
    chrome.storage.onChanged.callListeners({ [key]: { newValue } }, 'local')
    await sleep(10)
  })

// As the background saves them at install: with the extension's key pair.
const extensionPrivateKey = ed25519.utils.randomPrivateKey()
const storedOptions = {
  ...defaultConnectorExtensionOptions,
  privateKey: Buffer.from(extensionPrivateKey).toString('hex'),
  publicKey: Buffer.from(ed25519.getPublicKey(extensionPrivateKey)).toString(
    'hex',
  ),
}

describe('Pairing', () => {
  let container: HTMLDivElement
  let root: Root

  const shownPassword = () =>
    container.querySelector('[data-testid="password"]')?.textContent

  beforeEach(async () => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    webRtc.generatedPasswords = 0
    vi.mocked(chrome.storage.local.get).mockImplementation(((key: string) =>
      Promise.resolve({
        [key]:
          key === 'connections'
            ? {}
            : key === 'options'
            ? storedOptions
            : undefined,
      })) as any)

    container = document.createElement('div')
    root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter>
          <Pairing />
        </MemoryRouter>,
      )
      await sleep(10)
    })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
  })

  it('shows the password of one pairing', () => {
    expect(webRtc.generatedPasswords).toBe(1)
    expect(shownPassword()).toMatch(/^[0-9a-f]{64}$/)
  })

  it('keeps the password when the stored connections change', async () => {
    const password = shownPassword()

    await storageChange('connections', {
      wallet: {
        walletName: 'Radix Wallet 1',
        walletPublicKey: 'wallet',
        password: '00'.repeat(32),
        accounts: [],
      },
    })

    expect(webRtc.generatedPasswords).toBe(1)
    expect(shownPassword()).toBe(password)
  })

  it('keeps the password when unrelated options change', async () => {
    const password = shownPassword()

    await storageChange('options', {
      ...storedOptions,
      showDAppRequestNotifications: false,
    })

    expect(webRtc.generatedPasswords).toBe(1)
    expect(shownPassword()).toBe(password)
  })

  it('starts a new pairing when the extension key pair changes', async () => {
    const privateKey = ed25519.utils.randomPrivateKey()

    await storageChange('options', {
      ...defaultConnectorExtensionOptions,
      privateKey: Buffer.from(privateKey).toString('hex'),
      publicKey: Buffer.from(ed25519.getPublicKey(privateKey)).toString('hex'),
    })

    expect(webRtc.generatedPasswords).toBe(2)
  })
})
