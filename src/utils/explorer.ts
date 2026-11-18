/**
 * The Radix Community explorer: one for every network, which it tells from the address
 * (`account_rdx…`, `account_tdx_2_…`). The Radix dashboards it replaces now redirect to
 * a host that does not answer.
 */
const explorerUrl = 'https://radix-community.genkipool.com/dashboard'

export const accountExplorerUrl = (address: string) =>
  `${explorerUrl}/account/${address}`

export const transactionExplorerUrl = (txId: string) =>
  `${explorerUrl}/tx/${txId}`
