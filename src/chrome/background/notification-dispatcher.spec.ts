import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  notificationDispatcher,
  requestNotificationContent,
  requestNotificationId,
  transactionOfNotification,
} from './notification-dispatcher'

const notification = {
  interactionId: 'abc',
  kind: 'transaction' as const,
}

describe('dApp request notifications', () => {
  beforeEach(() => {
    vi.mocked(chrome.storage.local.get).mockImplementation(((key: string) =>
      Promise.resolve({
        [key]: key === 'options' ? { showDAppRequestNotifications: true } : {},
      })) as any)
    vi.mocked(chrome.notifications.create).mockImplementation(((
      id: string,
      _options: unknown,
      callback: (id: string) => void,
    ) => callback(id)) as any)
    vi.mocked(chrome.notifications.update).mockImplementation(((
      _id: string,
      _options: unknown,
      callback: (updated: boolean) => void,
    ) => callback(true)) as any)
    vi.mocked(chrome.notifications.clear).mockImplementation(((
      _id: string,
      callback: (cleared: boolean) => void,
    ) => callback(true)) as any)
  })

  afterEach(() => {
    vi.mocked(chrome.storage.local.get).mockReset()
    vi.mocked(chrome.notifications.create).mockReset()
    vi.mocked(chrome.notifications.update).mockReset()
    vi.mocked(chrome.notifications.clear).mockReset()
  })

  it('says whether the wallet is connected', () => {
    expect(requestNotificationContent('transaction', false)).toEqual({
      title: 'Transaction Request Pending',
      message:
        "Your Radix Wallet isn't connected — open the app on your phone to receive this request",
    })
    expect(requestNotificationContent('transaction', true)).toEqual({
      title: 'Transaction Request Pending',
      message: 'Open your Radix Wallet app to review the transaction',
    })
    expect(requestNotificationContent('login', true).message).toBe(
      'Open your Radix Wallet app to login',
    )
  })

  it('shows one notification per request, with its state', async () => {
    await notificationDispatcher.request({
      ...notification,
      action: 'create',
      walletConnected: false,
    })

    expect(chrome.notifications.create).toHaveBeenCalledWith(
      requestNotificationId('abc'),
      expect.objectContaining({
        title: 'Transaction Request Pending',
        message:
          "Your Radix Wallet isn't connected — open the app on your phone to receive this request",
      }),
      expect.any(Function),
    )
  })

  it('changes it in place once the wallet connected, and removes it at the end', async () => {
    await notificationDispatcher.request({
      ...notification,
      action: 'update',
      walletConnected: true,
    })
    await notificationDispatcher.request({
      ...notification,
      action: 'clear',
      walletConnected: true,
    })

    expect(chrome.notifications.update).toHaveBeenCalledWith(
      'dAppRequest___abc',
      {
        title: 'Transaction Request Pending',
        message: 'Open your Radix Wallet app to review the transaction',
      },
      expect.any(Function),
    )
    expect(chrome.notifications.clear).toHaveBeenCalledWith(
      'dAppRequest___abc',
      expect.any(Function),
    )
    expect(chrome.notifications.create).not.toHaveBeenCalled()
  })

  it('shows none when dApp request notifications are off', async () => {
    vi.mocked(chrome.storage.local.get).mockImplementation(((key: string) =>
      Promise.resolve({
        [key]: { showDAppRequestNotifications: false },
      })) as any)

    await notificationDispatcher.request({
      ...notification,
      action: 'create',
      walletConnected: true,
    })

    expect(chrome.notifications.create).not.toHaveBeenCalled()
  })
})

describe('notification ids', () => {
  it('reads back the transaction of a transaction notification only', () => {
    expect(
      transactionOfNotification('transaction___2___txid_tdx_2_1abc'),
    ).toEqual({ networkId: 2, txId: 'txid_tdx_2_1abc' })
    expect(transactionOfNotification(requestNotificationId('abc'))).toBe(
      undefined,
    )
    expect(transactionOfNotification('transaction')).toBe(undefined)
  })
})
