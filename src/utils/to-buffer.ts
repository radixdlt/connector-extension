import { Buffer } from 'buffer'
const hasArrayBuffer = typeof ArrayBuffer === 'function'
const { toString } = Object.prototype

function isArrayBuffer(value: unknown): boolean {
  return (
    hasArrayBuffer &&
    (value instanceof ArrayBuffer ||
      toString.call(value) === '[object ArrayBuffer]')
  )
}

export const toBuffer = (input: Buffer | string | ArrayBuffer): Buffer => {
  if (typeof input === 'string') {
    return Buffer.from(input, 'utf-8')
  } else if (isArrayBuffer(input)) {
    return Buffer.from(input)
  } else {
    return input as Buffer
  }
}
