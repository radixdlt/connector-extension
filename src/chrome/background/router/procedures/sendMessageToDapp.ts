import { rootProcedure } from './root'
import * as v from 'valibot'

export const sendMessageToDappProcedure = rootProcedure
  .input(v.parser(v.any()))
  .query(async ({ ctx }) => {
    // await ctx.sendMessageToDapp(1, {})
  })
