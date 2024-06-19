export const parseAddress = (
  address: string,
): { networkId: number; type: string } => {
  const match = address.match(/^([a-z]+)_(rdx|sim|tdx_[\d]+_)1(?:[a-z0-9]+)$/)

  if (!match) {
    throw new Error(`Invalid address ${address}`)
  }

  const [, type, network] = match

  const networkId =
    network === 'rdx' ? 1 : network === 'sim' ? 242 : network.split('_')[1]

  return {
    networkId: Number(networkId),
    type,
  }
}
