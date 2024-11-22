import { loggerMiddleware } from '../middleware/logger'
import { trpc } from '../trpc'

export const rootProcedure = trpc.procedure.use(loggerMiddleware)
