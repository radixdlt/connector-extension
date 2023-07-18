import { TransactionStatus } from '@radixdlt/babylon-gateway-api-sdk'
import { createNotification } from 'chrome/helpers/chrome-notifications'
import {
  getShowDAppRequestNotifications,
  getShowTransactionResultNotifications,
} from 'options'

export const txNotificationPrefix = 'transaction_'

export const notificationDispatcher = {
  request: (discriminator: string) => {
    getShowDAppRequestNotifications().map((showDAppRequestNotifications) => {
      if (!showDAppRequestNotifications || discriminator === 'cancelRequest') {
        return
      }

      const titles: Record<string, string> = {
        authorizedRequest: 'Pending login request',
        unauthorizedRequest: 'Pending data request',
        transaction: 'Pending transaction request',
      }
      createNotification(
        undefined,
        titles[discriminator] || 'Pending wallet interaction',
        'Please open your Radix Wallet',
      )
    })
  },
  transaction: (txId: string, status: TransactionStatus) => {
    getShowTransactionResultNotifications().map(
      (showTransactionResultNotifications) => {
        if (!showTransactionResultNotifications) {
          return
        }

        const title =
          status === 'CommittedSuccess'
            ? 'Transaction successful'
            : 'Transaction failed'

        createNotification(
          `${txNotificationPrefix}${txId}`,
          title,
          'Click to see transaction recipe',
        )
      },
    )
  },
}
