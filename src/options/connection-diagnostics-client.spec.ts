import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requestConnectionDiagnostics } from './connection-diagnostics-client'

describe('requestConnectionDiagnostics', () => {
  beforeEach(() => {
    // @ts-expect-error vitest-chrome events can be reset from tests
    chrome.runtime.onMessage.clearListeners()
    vi.mocked(chrome.runtime.sendMessage).mockReset()
  })

  const answer = (data: unknown, messageId?: string) => {
    const request = vi.mocked(chrome.runtime.sendMessage).mock
      .calls[0][0] as unknown as { messageId: string }
    // @ts-expect-error vitest-chrome events can be triggered from tests
    chrome.runtime.onMessage.callListeners({
      discriminator: 'confirmation',
      messageId: messageId ?? request.messageId,
      success: true,
      data,
    })
  }

  it('resolves with the offscreen document answer to this request', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined as never)
    const response = { connections: [] }

    const result = requestConnectionDiagnostics(1000)
    answer({ connections: ['not for this request'] }, 'another-request')
    answer(response)

    expect((await result)._unsafeUnwrap()).toEqual(response)
    expect(
      vi.mocked(chrome.runtime.sendMessage).mock.calls[0][0],
    ).toMatchObject({ discriminator: 'getConnectionDiagnostics' })
    expect(chrome.runtime.onMessage.hasListeners()).toBe(false)
  })

  it('fails when nobody answers in time and removes its listener', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(
      new Error('The message port closed before a response was received.'),
    )

    const result = await requestConnectionDiagnostics(20)

    expect(result._unsafeUnwrapErr().message).toBe(
      'the offscreen document did not answer',
    )
    expect(chrome.runtime.onMessage.hasListeners()).toBe(false)
  })
})
