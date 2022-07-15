import chunksToBuffer from '../chunks-to-buffer'
import bufferToChunks from '../buffer-to-chunks'

import fs from 'fs'
import path from 'path'

describe('#chunk file', () => {
  it('Should create a whole out of chunks', () => {
    fs.readFile(
      path.resolve(__dirname, './test-file.txt'),
      undefined,
      (err, data) => {
        if (err) {
          console.error(err)
          return
        }
        const chunks = bufferToChunks(data, 16)
        const result = chunksToBuffer(chunks)
        expect(result.toString('utf8')).toEqual(data.toString('utf8'))
      }
    )
  })
})
