import { Subject } from 'rxjs'

export const LedgerSubjects = () => ({
  onProgressSubject: new Subject<string>(),
  connectedDeviceIdSubject: new Subject<number | undefined>(),
})
