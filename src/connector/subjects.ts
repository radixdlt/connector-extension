import { BehaviorSubject } from 'rxjs'

export type ConnectorSubjectsType = ReturnType<typeof ConnectorSubjects>

export const ConnectorSubjects = () => ({
  pairingStateSubject: new BehaviorSubject<'paired' | 'notPaired' | 'loading'>(
    'loading'
  ),
})
