import bufferToChunks from '../buffer-to-chunks'

import fs from 'fs'
import path from 'path'

describe('#buffer-to-chunk', function () {
  it('Should return array of buffer chunks', function () {})
  fs.readFile(
    path.resolve(__dirname, './test-file.txt'),
    undefined,
    (err, data) => {
      if (err) {
        console.error(err)
        return
      }
      const chunks = bufferToChunks(data, 16)
      expect(chunks.join('')).toEqual(data.toString())
    }
  )
})
