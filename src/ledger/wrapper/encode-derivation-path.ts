import { getDataLength } from './utils'

export const encodeDerivationPath = (derivationPath: string) => {
  const path = derivationPath.split('H').join(`'`).slice(2).split('/')
  const length = `00${(path.length & 0xff).toString(16)}`.slice(-2)

  const parts = path
    .map(
      (value) => (value.endsWith("'") ? 0x80000000 : 0) + parseInt(value, 10),
    )
    .map((value) => value.toString(16).padStart(8, '0'))
    .join('')

  const data = `${length}${parts}`
  const dataLength = getDataLength(data)

  return `${dataLength}${data}`
}
