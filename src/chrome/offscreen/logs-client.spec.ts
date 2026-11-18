import { describe, it, expect } from 'vitest'
import { LogsClient, type Log } from './logs-client'

describe('LogsClient', () => {
  it('exports each line with its level and full logger name', () => {
    const logsClient = LogsClient()

    logsClient.add({
      0: 'wallet=abcd1234',
      1: 'iroh: the wallet connected',
      _meta: {
        date: new Date(0),
        logLevelId: 3,
        logLevelName: 'INFO',
        name: 'iroh',
        parentNames: ['offScreen', '[WCC]'],
        runtime: 'browser',
        browser: 'test',
      },
    } as unknown as Log)

    const { logs } = JSON.parse(logsClient.toString())
    expect(logs[0]).toMatch(
      // The time is in the machine's locale (e.g. "12:00:00 AM.0" in en-US).
      /^\[[^\]]+ INFO offScreen:\[WCC\]:iroh\] wallet=abcd1234 iroh: the wallet connected$/,
    )
  })
})
