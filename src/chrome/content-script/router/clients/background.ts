import { createTRPCProxyClient } from '@trpc/client'
import { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import { BackgroundRouter, publicRouter } from 'chrome/background/router/router'
import { getTabId } from '../../helpers/getTabId'
import { chromeLink } from 'trpc-chrome/link'

type RouterInput = inferRouterInputs<typeof publicRouter>
type RouterOutput = inferRouterOutputs<typeof publicRouter>

type BackgroundClient = ReturnType<
  typeof createTRPCProxyClient<BackgroundRouter>
>
export type BackgroundClientMethod = keyof BackgroundClient

const callMethodFactory =
  (
    backgroundClientInstance: ReturnType<
      typeof createTRPCProxyClient<BackgroundRouter>
    >,
    tabId: number,
    origin: string,
  ) =>
  <M extends keyof RouterInput>(method: M) =>
  (data: unknown): Promise<RouterOutput[M]> => {
    // @ts-expect-error
    return backgroundClientInstance['public'][method].query({
      data,
      metadata: { tabId, origin, caller: 'contentScript' },
    })
  }

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
