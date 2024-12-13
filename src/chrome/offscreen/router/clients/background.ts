import { createTRPCProxyClient } from '@trpc/client'
import { BackgroundRouter } from 'chrome/background/router/router'
import { chromeLink } from 'trpc-chrome/link'

const port = chrome.runtime.connect()
export const backgroundClient = createTRPCProxyClient<BackgroundRouter>({
  links: [chromeLink({ port })],
})
