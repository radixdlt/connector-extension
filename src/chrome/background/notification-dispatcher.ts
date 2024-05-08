import { TransactionStatus } from '@radixdlt/babylon-gateway-api-sdk'
import { WalletInteraction } from '@radixdlt/radix-dapp-toolkit'
import { createNotification } from 'chrome/helpers/chrome-notifications'
import {
  getShowDAppRequestNotifications,
  getShowTransactionResultNotifications,
} from 'options'

export const txNotificationPrefix = 'transaction'
export const txNotificationSplitter = '___'
export const notificationDispatcher = {
  request: ({ items }: WalletInteraction) => {
    getShowDAppRequestNotifications().map((showDAppRequestNotifications) => {
      if (
        !showDAppRequestNotifications ||
        items.discriminator === 'cancelRequest'
      ) {
        return
      }

      const contentDiscriminator =
        items.discriminator === 'transaction'
          ? 'transaction'
          : items.discriminator === 'unauthorizedRequest'
          ? 'dataRequest'
          : items.discriminator === 'authorizedRequest' &&
            items.auth.discriminator === 'usePersona'
          ? 'dataRequest'
          : 'loginRequest'

      const content: Record<string, { title: string; message: string }> = {
        loginRequest: {
          title: 'Login Request Pending',
          message: 'Open your Radix Wallet app to login',
        },
        dataRequest: {
          title: 'Data Request Pending',
          message: 'Open your Radix Wallet app to review the request',
        },
        transaction: {
          title: 'Transaction Request Pending',
          message: 'Open your Radix Wallet app to review the transaction',
        },
      }

      createNotification(
        undefined,
        content[contentDiscriminator].title,
        content[contentDiscriminator].message,
      )
    })
  },
  transaction: (networkId: number, txId: string, status: TransactionStatus) => {
    getShowTransactionResultNotifications().map(
      (showTransactionResultNotifications) => {
        if (!showTransactionResultNotifications) {
          return
        }

        const title =
          status === 'CommittedSuccess'
            ? 'Transaction Successful'
            : 'Transaction Failed'

        createNotification(
          [txNotificationPrefix, networkId, txId].join(txNotificationSplitter),
          title,
          'View more info on the Radix Dashboard',
          [
            {
              title: 'View',
            },
          ],
        )
      },
    )
  },
}
