import { extensionStatusProcedure } from './procedures/extensionStatus'
import { openPopupProcedure } from './procedures/openPopup'
import { trpc } from './trpc'

export const publicRouter = trpc.router({
  openPopup: openPopupProcedure,
  extensionStatus: extensionStatusProcedure,
})

export const backgroundRouter = trpc.router({
  public: publicRouter,
})

export type BackgroundRouter = typeof backgroundRouter
