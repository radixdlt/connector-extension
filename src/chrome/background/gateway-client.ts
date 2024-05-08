import {
  GatewayApiClient,
  RadixNetworkConfigById,
  TransactionStatus,
  TransactionStatusResponse,
} from '@radixdlt/babylon-gateway-api-sdk'
import {
  ExponentialBackoff,
  ExponentialBackoffInput,
} from '@radixdlt/radix-dapp-toolkit'
import { Result, ResultAsync } from 'neverthrow'
import { firstValueFrom, switchMap, filter, first } from 'rxjs'

export const GatewayClient = ({
  gatewayApi,
  retryConfig,
}: {
  gatewayApi: GatewayApiClient
  retryConfig?: ExponentialBackoffInput
}) => {
  const pollTransactionStatus = (transactionIntentHashHex: string) => {
    const retry = ExponentialBackoff(retryConfig)

    const completedTransactionStatus = new Set<TransactionStatus>([
      'CommittedSuccess',
      'CommittedFailure',
      'Rejected',
    ])

    return ResultAsync.fromPromise(
      firstValueFrom(
        retry.withBackoff$.pipe(
          switchMap((result) => {
            if (result.isErr()) return [result]

            return ResultAsync.fromPromise(
              gatewayApi.transaction
                .getStatus(transactionIntentHashHex)
                .then((response) => {
                  if (completedTransactionStatus.has(response.status))
                    return response

                  retry.trigger.next()
                }),
              (error) => error as Error,
            ).mapErr((response) => {
              return Error('failedToPollSubmittedTransaction')
            })
          }),
          filter(
            (result): result is Result<TransactionStatusResponse, Error> =>
              (result.isOk() && !!result.value) || result.isErr(),
          ),
          first(),
        ),
      ),
      (error) => error as Error,
    ).andThen((result) => result)
  }

  return { pollTransactionStatus, gatewayApi }
}

export const createGatewayClient = (networkId: number) =>
  GatewayClient({
    gatewayApi: GatewayApiClient.initialize({
      basePath: RadixNetworkConfigById[networkId].gatewayUrl,
      applicationName: 'Radix Connector Extension',
    }),
  })
