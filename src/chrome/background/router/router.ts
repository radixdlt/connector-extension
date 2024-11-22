import { extensionStatusProcedure } from './procedures/extensionStatus'
import { openPopupProcedure } from './procedures/openPopup'
import { sendMessageToDappProcedure } from './procedures/sendMessageToDapp'
import { trpc } from './trpc'

export const publicRouter = trpc.router({
  openPopup: openPopupProcedure,
  extensionStatus: extensionStatusProcedure,
})

export const backgroundRouter = trpc.router({
  public: publicRouter,
  internal: trpc.router({
    sendMessageToDapp: sendMessageToDappProcedure,
  }),
})

export type BackgroundRouter = typeof backgroundRouter
