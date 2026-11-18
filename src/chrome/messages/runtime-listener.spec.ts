import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMessage } from './create-message'
import { extensionPageSender, webPageSender } from './senders.test-utils'
import { runtimeMessageListener } from './runtime-listener'
import type { MessageClient } from './message-client'

describe('the runtime listener of the background and the offscreen document', () => {
  afterEach(() => {
    ;(chrome.runtime as any).id = undefined
  })

  const setup = () => {
    ;(chrome.runtime as any).id = 'test-extension'
    const onMessage = vi.fn()
    const warn = vi.fn()
    const listen = runtimeMessageListener(
      { onMessage } as unknown as MessageClient,
      { warn } as any,
    )
    return { listen, onMessage, warn }
  }

  it("passes on the extension's messages, and those a web page may send", () => {
    const { listen, onMessage, warn } = setup()

    listen(createMessage.restartConnector(), extensionPageSender())
    listen(
      createMessage.dAppRequest('contentScript', {} as any),
      webPageSender(4),
    )

    expect(onMessage).toHaveBeenCalledTimes(2)
    expect(onMessage.mock.calls[1][1]).toBe(4)
    expect(warn).not.toHaveBeenCalled()
  })

  it('drops, and logs, what a web page may not send', () => {
    const { listen, onMessage, warn } = setup()

    listen(createMessage.restartConnector(), webPageSender(4))

    expect(onMessage).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it("takes a content script's request for its tab id for none of them, and logs nothing", () => {
    const { listen, onMessage, warn } = setup()

    listen({ type: 'getTabId' } as any, webPageSender(4))

    expect(onMessage).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })
})
