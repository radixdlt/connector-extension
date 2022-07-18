import { ok, Result, err } from 'neverthrow'

export const bufferToChunks = (
  file: Buffer,
  byteCount: number
): Result<Buffer[], Error> => {
  const chunks: Buffer[] = []
  const total = file.byteLength

  if (total <= 0 || byteCount <= 0 || byteCount > total)
    return err(new Error('byteLength/byteCount out of boundaries'))

  let offset = 0
  while (offset + byteCount < total) {
    chunks.push(file.subarray(offset, byteCount + offset))
    offset += byteCount
  }
  const slice = file.subarray(offset, byteCount + offset)
  chunks.push(slice)
  return ok(chunks)
}
