import WSS from 'jest-websocket-mock'
import { signalingServerClient } from './signaling-server-client'
import { Status, wsStatusSubject } from './subjects'
import { subscribeSpyTo } from '@hirez_io/observer-spy'
import { filter, firstValueFrom } from 'rxjs'

const url = 'ws://localhost:1234'
let wss: WSS
let client = signalingServerClient(url)
let wsStatusSpy: ReturnType<typeof subscribeSpyTo<Status>>

const waitUntilConnected = async () =>
firstValueFrom(
  wsStatusSubject.pipe(filter((status) => status === 'connected'))
)

describe('Signaling server client', () => {
  beforeEach(async () => {
    wsStatusSpy = subscribeSpyTo(wsStatusSubject)
    wss = new WSS(url)
  })

  afterEach(() => {
    WSS.clean()
  })

  it('should successfully connect and emit status', async () => {
    client.connect()
    await waitUntilConnected()
    expect(wsStatusSpy.getValues()).toEqual(['connecting','connected'])
  })
})


