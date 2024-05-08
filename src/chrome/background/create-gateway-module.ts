import { RadixNetworkConfigById } from '@radixdlt/babylon-gateway-api-sdk'
import { GatewayModule } from '@radixdlt/radix-dapp-toolkit'
import { __VERSION__ } from 'version'

export const createGatewayModule = (networkId: number) =>
  GatewayModule({
    clientConfig: {
      basePath: RadixNetworkConfigById[networkId].gatewayUrl,
      applicationName: 'Radix Connector Extension',
      applicationVersion: __VERSION__,
      applicationDappDefinitionAddress: '',
    },
  })
