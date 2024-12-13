import { createTRPCProxyClient } from '@trpc/client'
import { OffscreenRouter } from 'chrome/offscreen/router/router'
import { chromeLink } from 'trpc-chrome/link'

let offscreenClient: ReturnType<
  typeof createTRPCProxyClient<OffscreenRouter>
> | null = null

export const getOffscreenClient = () => {
  if (offscreenClient) return offscreenClient

  const port = chrome.runtime.connect()
  offscreenClient = createTRPCProxyClient<OffscreenRouter>({
    links: [chromeLink({ port })],
  })

  return offscreenClient
}

export type GetOffscreenClient = typeof getOffscreenClient
