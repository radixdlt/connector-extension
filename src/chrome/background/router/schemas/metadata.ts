import * as v from 'valibot'

export const metadataSchema = v.object({
  metadata: v.object({
    tabId: v.number(),
    origin: v.string(),
    caller: v.literal('contentScript'),
  }),
})
