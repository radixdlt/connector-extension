import { describe, it, expect } from 'vitest'
import { includesIroh, isPublicReleaseRef } from './release-channel'

describe('release channel', () => {
  it.each(['main', 'release/1.6.0', 'refs/heads/release/2.0'])(
    'treats %s as a public release',
    (ref) => {
      expect(isPublicReleaseRef(ref)).toBe(true)
    },
  )

  it.each(['', 'develop', 'feature/radix-connect-iroh', 'mainline'])(
    'does not treat %j as a public release',
    (ref) => {
      expect(isPublicReleaseRef(ref)).toBe(false)
    },
  )

  it('leaves iroh out of public releases without dev tools', () => {
    expect(includesIroh({ githubRefName: 'main', isDevMode: false })).toBe(
      false,
    )
    expect(
      includesIroh({ githubRefName: 'release/1.6.0', isDevMode: false }),
    ).toBe(false)
  })

  it('includes iroh in dev tools builds and non-release builds', () => {
    expect(includesIroh({ githubRefName: 'main', isDevMode: true })).toBe(true)
    expect(includesIroh({ githubRefName: 'develop', isDevMode: false })).toBe(
      true,
    )
    expect(includesIroh({ githubRefName: '', isDevMode: false })).toBe(true)
  })
})
