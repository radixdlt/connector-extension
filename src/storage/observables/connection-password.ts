import { StorageSubjectsType } from 'storage/subjects'
import { switchMap } from 'rxjs'
import { ChromeApiType } from 'chrome/chrome-api'

export const addConnectionPassword = (
  subjects: StorageSubjectsType,
  chromeApi: ChromeApiType
) =>
  subjects.addConnectionPasswordSubject.pipe(
    switchMap((buffer) =>
      chromeApi.storage.setItem('connectionPassword', buffer.toString('hex'))
    )
  )

export const removeConnectionPassword = (
  subjects: StorageSubjectsType,
  chromeApi: ChromeApiType
) =>
  subjects.removeConnectionPasswordSubject.pipe(
    switchMap(() => chromeApi.storage.removeItem('connectionPassword'))
  )
