import { irohErrorCodes } from './iroh-bindings'

/** Resolves with `promise`, or with `undefined` after `ms`. Never rejects. */
export const settleWithin = <T>(promise: Promise<T>, ms: number) =>
  new Promise<T | undefined>((resolve) => {
    const timer = setTimeout(() => resolve(undefined), ms)
    const done = (value: T | undefined) => {
      clearTimeout(timer)
      resolve(value)
    }
    promise.then(done, () => done(undefined))
  })

/** Rejects with a `timeout` error if `promise` has not settled after `ms`. */
export const settleOrTimeout = <T>(promise: Promise<T>, ms: number) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          Object.assign(new Error('the iroh session did not settle the call'), {
            code: irohErrorCodes.timeout,
          }),
        ),
      ms,
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
