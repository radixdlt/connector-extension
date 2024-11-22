import { addLogProcedure } from './procedures/addLog'
import { trpc } from './trpc'

export const offscreenRouter = trpc.router({
  log: addLogProcedure,
})

export type OffscreenRouter = typeof offscreenRouter
