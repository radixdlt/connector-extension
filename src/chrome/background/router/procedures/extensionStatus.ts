import { rootProcedure } from './root'
import * as v from 'valibot'
import { metadataSchema } from '../schemas/metadata'
import { extensionStatusEvent } from 'chrome/dapp/_types'

export const extensionStatusProcedure = rootProcedure
  .input(
    v.parser(
      v.intersect([
        metadataSchema,
        v.object({
          data: v.object({ discriminator: v.literal('extensionStatus') }),
        }),
      ]),
    ),
  )
  .query(async ({ ctx, input }) => {
    const isWalletLinked = await ctx.hasConnections().unwrapOr(false)

    return ctx.contentScriptClient.sendMessageToDapp(
      input.metadata.tabId,
      extensionStatusEvent(isWalletLinked),
    )
  })
