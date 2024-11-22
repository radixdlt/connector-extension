import { trpc } from '../trpc'

export const loggerMiddleware = trpc.middleware(
  async ({ ctx, path, rawInput, next }) => {
    const childLogger = ctx.logger.getSubLogger({
      name: `router.${path} `,
    })
    childLogger.debug(rawInput)

    return next()
  },
)
