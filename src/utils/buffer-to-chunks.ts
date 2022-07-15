const bufferToChunks = (file: Buffer, byteCount: number): Buffer[] => {
  const chunks: Buffer[] = []
  const total = file.byteLength
  let offset = 0
  while (offset + byteCount < total) {
    chunks.push(file.subarray(offset, byteCount + offset))
    offset += byteCount
  }
  const slice = file.subarray(offset, byteCount + offset)
  chunks.push(slice)
  return chunks
}

export default bufferToChunks
