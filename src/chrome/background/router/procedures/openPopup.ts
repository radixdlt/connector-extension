import { rootProcedure } from './root'
import * as v from 'valibot'
import { metadataSchema } from '../schemas/metadata'

export const openPopupProcedure = rootProcedure
  .input(
    v.parser(
      v.intersect([
        metadataSchema,
        v.object({
          data: v.object({ discriminator: v.literal('openPopup') }),
        }),
      ]),
    ),
  )
  .query(({ ctx }) => {
    return ctx.openParingPopup()
  })
