import { ChromeApiType } from 'chrome/chrome-api'
import { Subscription } from 'rxjs'
import { addConnectionPassword } from './observables/connection-password'
import { StorageSubjectsType } from './subjects'

export const storageSubscriptions = (
  subjects: StorageSubjectsType,
  chromeAPI: ChromeApiType
) => {
  const subscription = new Subscription()
  subscription.add(addConnectionPassword(subjects, chromeAPI).subscribe())
  return subscription
}
