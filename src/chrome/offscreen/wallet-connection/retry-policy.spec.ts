import { describe, it, expect } from 'vitest'
import { dAppRequestRetryPolicy } from './wallet-connection-client'

describe('dApp request retry policy', () => {
  it('waits for a wallet as long as none is connected', () => {
    expect(dAppRequestRetryPolicy.shouldRetry('notConnected', 50)).toBe(true)
  })

  it('otherwise gives up after the last attempt', () => {
    const { maxAttempts, shouldRetry } = dAppRequestRetryPolicy
    expect(shouldRetry('timeout', 1)).toBe(true)
    expect(shouldRetry('timeout', maxAttempts - 1)).toBe(true)
    expect(shouldRetry('timeout', maxAttempts)).toBe(false)
  })
})
