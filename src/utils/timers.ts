/** The timer functions, injectable so that tests can drive time. */
export type Timers = {
  setInterval: (callback: () => void, ms: number) => unknown
  clearInterval: (handle: any) => void
  setTimeout: (callback: () => void, ms: number) => unknown
  clearTimeout: (handle: any) => void
}

/** The global timers, looked up on each call (so fake timers in tests apply). */
export const globalTimers: Timers = {
  setInterval: (callback, ms) => setInterval(callback, ms),
  clearInterval: (handle) => clearInterval(handle),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle),
}
