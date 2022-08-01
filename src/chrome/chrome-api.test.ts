import { chromeAPI } from './chrome-api'

describe('chromeApi', () => {
  describe('storage', () => {
    it('should set an item', async () => {
      const item = { foo: 'bar' }

      let actual: any[] = []
      const expected = [item]

      // @ts-ignore
      // eslint-disable-next-line max-nested-callbacks
      chrome.storage.sync.set.mockImplementation((value) => {
        actual.push(value)
        return Promise.resolve()
      })

      const result = await chromeAPI.storage.setItem(item)

      if (result.isErr()) throw result.error

      expect(expected).toEqual(actual)
    })
    it('should get an item', async () => {
      const item = { foo: 'bar' }
      const expected = item.foo

      // @ts-ignore
      // eslint-disable-next-line max-nested-callbacks
      chrome.storage.sync.get.mockImplementation((_, callback) => {
        callback(item)
      })

      const result = await chromeAPI.storage.getItem('foo')

      if (result.isErr()) throw result.error

      expect(expected).toEqual(result.value)
    })

    it('should get an undefined item', async () => {
      const item = {}
      const expected = undefined

      // @ts-ignore
      // eslint-disable-next-line max-nested-callbacks
      chrome.storage.sync.get.mockImplementation((_, callback) => {
        callback(item)
      })

      const result = await chromeAPI.storage.getItem('foo')

      if (result.isErr()) throw result.error

      expect(expected).toEqual(result.value)
    })

    it('should get all items', async () => {
      const item = { one: '1', two: '2', three: '3' }
      const expected = item

      // @ts-ignore
      // eslint-disable-next-line max-nested-callbacks
      chrome.storage.sync.get.mockImplementation((_, callback) => {
        callback(item)
      })

      const result = await chromeAPI.storage.getAllItems()

      if (result.isErr()) throw result.error

      expect(expected).toEqual(result.value)
    })

    it('should remove an item', async () => {
      const item: any = { one: '1', two: '2', three: '3' }
      const expected = item

      // @ts-ignore
      // eslint-disable-next-line max-nested-callbacks
      chrome.storage.sync.remove.mockImplementation((key: string) => {
        delete item[key]
        return Promise.resolve()
      })

      const result = await chromeAPI.storage.removeItem('two')

      if (result.isErr()) throw result.error

      expect(expected).toEqual({ one: '1', three: '3' })
    })

    it('should add and remove storage event listener', async () => {
      const item = { foo: 'bar' }
      const listenerSpy = jest.fn()
      const sendResponseSpy = jest.fn()
      chrome.storage.onChanged.addListener(listenerSpy)

      expect(listenerSpy).not.toBeCalled()
      expect(chrome.storage.onChanged.hasListener(listenerSpy)).toBe(true)

      // @ts-ignore
      // eslint-disable-next-line max-nested-callbacks
      chrome.storage.sync.set.mockImplementation(() => {
        listenerSpy(item)
      })

      await chrome.storage.sync.set(item)

      expect(listenerSpy).toBeCalledWith({ foo: 'bar' })

      chrome.storage.onChanged.removeListener(listenerSpy)
      expect(chrome.storage.onChanged.hasListener(listenerSpy)).toBe(false)
    })
  })

  describe('message', () => {
    it('should send a message', async () => {
      const message = { greeting: 'hello' }

      // @ts-ignore
      // eslint-disable-next-line max-nested-callbacks
      chrome.tabs.sendMessage.mockImplementation(
        // @ts-ignore
        // eslint-disable-next-line max-nested-callbacks, max-params
        (tabId, _, __, callback) => {
          expect(tabId).toBe(1)
          return Promise.resolve(callback())
        }
      )

      const result = await chromeAPI.sendMessage(1, message, {})

      if (result.isErr()) throw result.error

      expect(result.isOk()).toBeTruthy()
    })
  })
})
