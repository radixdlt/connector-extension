import { createTRPCProxyClient } from '@trpc/client'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import type {
  BackgroundRouter,
  publicRouter,
} from 'chrome/background/router/router'
import { getTabId } from '../../helpers/getTabId'
import { chromeLink } from 'trpc-chrome/link'

type RouterInput = inferRouterInputs<typeof publicRouter>
type RouterOutput = inferRouterOutputs<typeof publicRouter>

type BackgroundClient = ReturnType<
  typeof createTRPCProxyClient<BackgroundRouter>
>
export type BackgroundClientMethod = keyof BackgroundClient

/**
 * The background's methods for web pages, by name: every one of the public router (a
 * check of the types, without bundling the router into the content script).
 */
const publicMethods = {
  openPopup: true,
  extensionStatus: true,
} as const satisfies Record<keyof RouterInput, true>

/** Whether a dApp's message names one of the background's public methods. */
export const isPublicMethod = (name: string): name is keyof RouterInput =>
  Object.hasOwn(publicMethods, name)

const callMethodFactory =
  (
    backgroundClientInstance: ReturnType<
      typeof createTRPCProxyClient<BackgroundRouter>
    >,
    tabId: number,
    origin: string,
  ) =>
  <M extends keyof RouterInput>(method: M) =>
  (data: unknown): Promise<RouterOutput[M]> =>
    // @ts-expect-error
    backgroundClientInstance['public'][method].query({
      data,
      metadata: { tabId, origin, caller: 'contentScript' },
    })

let backgroundClient: ReturnType<typeof callMethodFactory> | null = null

export const getBackgroundClient = async () => {
  if (backgroundClient) return backgroundClient

  const port = chrome.runtime.connect()

  const createdBackgroundClient = createTRPCProxyClient<BackgroundRouter>({
    links: [chromeLink({ port })],
  })

  const tabId = await getTabId()

  backgroundClient = callMethodFactory(
    createdBackgroundClient,
    tabId,
    window.location.origin,
  )

  return backgroundClient
}
