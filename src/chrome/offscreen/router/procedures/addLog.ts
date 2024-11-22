import { rootProcedure } from './root'
import * as v from 'valibot'

export const addLogProcedure = rootProcedure
  .input(v.parser(v.any()))
  .query(async (opts) => {
    console.log('log', opts.input)
  })
