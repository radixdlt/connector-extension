import { addContentScriptClientMiddleware } from '../middleware/addContentScriptClient'
import { addOffscreenClientMiddleware } from '../middleware/addOffscreenClient'
import { loggerMiddleware } from '../middleware/logger'
import { trpc } from '../trpc'

export const rootProcedure = trpc.procedure.use(loggerMiddleware)
// .use(addOffscreenClientMiddleware)
// .use(addContentScriptClientMiddleware)
