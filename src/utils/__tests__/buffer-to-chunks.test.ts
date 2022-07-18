import { bufferToChunks } from '../buffer-to-chunks'

import fs from 'fs'
import path from 'path'

describe('#buffer-to-chunk', () => {
  it('Should return array of buffer chunks', () => {
    fs.readFile(
      path.resolve(__dirname, './test-file.txt'),
      undefined,
      (err, data) => {
        if (err) {
          console.error(err)
          return
        }
        const chunks = bufferToChunks(data, 16)
        if (chunks.isErr()) throw chunks.error
        expect(chunks.value.join('')).toEqual(data.toString())
      }
    )
  })

  it('Should return error if byteLength is out of boundaries', () => {
    const chunks = bufferToChunks({ byteLength: 0 } as any, 16)
    expect(chunks.isErr()).toBeTruthy()
  })

  it('Should return error if byteCount is out of boundaries', () => {
    fs.readFile(
      path.resolve(__dirname, './test-file.txt'),
      undefined,
      (err, data) => {
        if (err) {
          console.error(err)
          return
        }
        const chunks = bufferToChunks(data, 0)
        expect(chunks.isErr()).toBeTruthy()
      }
    )
  })
})
