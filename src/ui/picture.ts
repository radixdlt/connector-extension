import { ResultAsync } from 'neverthrow'

/** The side of a wallet picture, in pixels: twice the card's avatar, for sharpness. */
export const pictureSize = 96

const maxFileBytes = 15 * 1024 * 1024

/**
 * `file` as a small square picture: its centre, scaled to `pictureSize`, as a
 * WebP data URL of a few KB, to keep in the extension's storage.
 */
export const pictureFromFile = (file: File): ResultAsync<string, Error> => {
  if (!file.type.startsWith('image/'))
    return ResultAsync.fromPromise(
      Promise.reject(new Error('not an image')),
      (error) => error as Error,
    )
  if (file.size > maxFileBytes)
    return ResultAsync.fromPromise(
      Promise.reject(new Error('the image is too large')),
      (error) => error as Error,
    )
  return ResultAsync.fromPromise(
    createImageBitmap(file).then((bitmap) => {
      const side = Math.min(bitmap.width, bitmap.height)
      const canvas = document.createElement('canvas')
      canvas.width = pictureSize
      canvas.height = pictureSize
      const context = canvas.getContext('2d')!
      context.imageSmoothingQuality = 'high'
      context.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        pictureSize,
        pictureSize,
      )
      bitmap.close()
      return canvas.toDataURL('image/webp', 0.85)
    }),
    () => new Error('the image could not be read'),
  )
}
