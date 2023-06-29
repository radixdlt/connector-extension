import { Result, err, ok } from 'neverthrow'
import { logger } from 'utils/logger'

export const validateZodSchema = <T>(
  schema: Zod.Schema<any>,
  value: T
): Result<T, { reason: string; error: any }> => {
  try {
    schema.parse(value)
    return ok(value)
  } catch (error) {
    logger.error('Failed zod schema validation', schema.description ?? '')
    return err({ reason: 'failedZodSchemaValidation', error })
  }
}
