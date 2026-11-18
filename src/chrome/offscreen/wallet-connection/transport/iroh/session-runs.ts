/**
 * Runs of a session, strictly one after the other, for the session wanted now. Each
 * change of what is wanted starts a new generation: the runs of an older one wind
 * down (their waits end at once), and the next run starts once the previous one has
 * finished. A failing run waits longer each time (`retryDelay`) before the next.
 */
export const SessionRuns = ({
  retryDelay,
  onRunFailed,
}: {
  retryDelay: { initial: number; max: number }
  /** A run threw: the chain goes on with the next. */
  onRunFailed: (error: unknown) => void
}) => {
  let generation = 0
  // Each run starts after the previous one finished.
  let lastRun: Promise<void> = Promise.resolve()
  const wakeUps = new Set<() => void>()

  return {
    /** A new generation, whose runs are the wanted ones; the waits of older ones end. */
    next: () => {
      generation += 1
      wakeUps.forEach((wakeUp) => wakeUp())
      return generation
    },
    /** Whether `runGeneration` is still the wanted one. */
    isLatest: (runGeneration: number) => runGeneration === generation,
    /** Runs `run` once the runs before it have finished. */
    chain: (run: () => Promise<void> | undefined) => {
      lastRun = lastRun.then(run).catch(onRunFailed)
      return lastRun
    },
    /** Resolves after `ms`, or earlier when a new generation starts. */
    wait: (ms: number) =>
      new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer)
          wakeUps.delete(done)
          resolve()
        }
        const timer = setTimeout(done, ms)
        wakeUps.add(done)
      }),
    /** How long to wait after `failures` failures in a row. */
    backoff: (failures: number) =>
      Math.min(
        retryDelay.initial * 2 ** Math.max(failures - 1, 0),
        retryDelay.max,
      ),
  }
}
