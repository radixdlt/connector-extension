import { initTRPC } from '@trpc/server'
import { createBackgroundRouterContext } from './context'

export const trpc = initTRPC
  .context<ReturnType<typeof createBackgroundRouterContext>>()
  .create({
    isServer: false,
    allowOutsideOfServer: true,
  })
