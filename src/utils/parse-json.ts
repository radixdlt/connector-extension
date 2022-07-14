import { err, ok, Result } from 'neverthrow'

export const parseJSON = <T>(text: string): Result<T, Error> => {
  try {
    return ok(JSON.parse(text))
  } catch (error) {
    return err(error as Error)
  }
}
