import { createLedgerErrorResponse } from './schemas'
import { describe, it, expect } from 'vitest'

describe('schemas', () => {
  describe('ledger error response creation', () => {
    it('should create generic ledger error response', () => {
      const res = createLedgerErrorResponse(
        { interactionId: '123', discriminator: 'signTransaction' },
        'tabClosed',
      )
      expect(res.error).toEqual({
        code: 0,
        message: 'tabClosed',
      })
    })

    it('should create non-generic ledger error response', () => {
      const res = createLedgerErrorResponse(
        { interactionId: '123', discriminator: 'signTransaction' },
        '6e38',
      )
      expect(res.error).toEqual({
        code: 1,
        message: '6e38',
      })
    })

    it('should create non-generic ledger error response', () => {
      const res = createLedgerErrorResponse(
        { interactionId: '123', discriminator: 'signTransaction' },
        '6e50',
      )
      expect(res.error).toEqual({
        code: 2,
        message: '6e50',
      })
    })
  })
})
