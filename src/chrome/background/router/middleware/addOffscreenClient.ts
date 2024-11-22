import { TRPCError } from '@trpc/server'
import { getOffscreenClient } from '../clients/offscreen'
import { trpc } from '../trpc'
import { logger } from 'utils/logger'

export const addOffscreenClientMiddleware = trpc.middleware(async (opts) => {
  const maybeOffscreenClient = getOffscreenClient()

  if (!maybeOffscreenClient)
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'could not instantiate offScreenClient',
    })

  const log = async (value: any, persist?: boolean) => {
    if (persist) await maybeOffscreenClient.log.query(value)
    logger.debug(value)
  }

  return opts.next({
    ctx: {
      offscreenClient: maybeOffscreenClient,
      log,
    },
  })
})
