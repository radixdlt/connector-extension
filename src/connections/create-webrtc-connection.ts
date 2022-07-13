import { ResultAsync } from 'neverthrow'
import { Subject } from 'rxjs'
import { makeWebRTC } from './webrtc'

// import in app.tsx
// connect()
//
// connect.ts
// const { ws, cleanup } = connectws(connectionId) // require either test version or prod version
// const isConnectionAlive = createWebRTCConnection(ws)
//
// isConnectionAlive.subscribe(handleConnectionRetry)
//
// when (webrtc connection is established) cleanup()

// in react for subscribe
// wsOutgoingMessageSubject.next({ method: 'subscribe', type: 'extension', connectionId })

let connectionId
let encryptionKey

const createWebRTCConnection = () => {
  connectionId = connectId
  encryptionKey = key

  const { peerConnection } = makeWebRTC()
  const iceCandidate = new Subject<RTCPeerConnectionIceEvent>()

  const setRemoteDescription = (offer: string): ResultAsync<void, Error> => {
    console.log('setting offer')
    // webrtcsetRemoteDescriptionSubject

    return ResultAsync.fromPromise(
      peerConnection.setRemoteDescription({
        type: 'offer',
        sdp: offer,
      }),
      (e) => e as Error
    )
  }

  const setLocalDescription = (answer: RTCSessionDescriptionInit) => {
    console.log('setting answer')
    // webrtcsetLocalDescriptionSubject

    return ResultAsync.fromPromise(
      peerConnection.setLocalDescription(answer),
      (e) => e as Error
    ).map(() => answer)
  }

  const createPeerConnectionAnswer = (): ResultAsync<
    RTCSessionDescriptionInit,
    Error
  > => {
    console.log('creating answer')
    // webrtcCreatePeerConnectionSubject

    return ResultAsync.fromPromise(
      peerConnection.createAnswer(),
      (e) => e as Error
    )
  }

  // wsIncommingMessage.pipe(filter on offers, parseDecrypt)

  offer$
    .pipe(
      tap((value) => {
        setRemoteDescription(value.payload.sdp)
          .andThen(createPeerConnectionAnswer)
          .andThen(setLocalDescription)
          .map(sendAnswer)
      })
    )
    .subscribe()

  const sendAnswer = (re) => {
    encrypt(
      Buffer.from(JSON.stringify({ sdp: payload.sdp })),
      encryptionKey
    ).map((res) => {
      const answer = {
        requestId: randomUUID(),
        method: 'answer',
        source: 'extension',
        connectionId,
        encryptedPayload: res.combined.toString('hex'),
      }
      console.log(`⬆️ sending answer`)
      console.log(answer)
      // wsOutgoingMessageSubject.next(...)
      ws.send(JSON.stringify(answer))
    })
  }

  // wsIncommingMessage.pipe(filter on candidates, parseDecrypt)

  icecandidate$
    .pipe(
      tap((value) => {
        console.log('adding ice candidate')
        peerConnection.addIceCandidate(new RTCIceCandidate(value.payload))
      })
    )
    .subscribe()

  // subscribe webrtcConnectionStateChange

  peerConnection.onconnectionstatechange = (event) => {
    console.log(
      'connectionState',
      (event.target as RTCPeerConnection).connectionState
    )
  }

  // subscribe webrtcOnIceCandidate

  peerConnection.onicecandidate = (e) => {
    iceCandidate.next(e)
    if (e.candidate !== null) sendCandidate(e.candidate)
  }

  export const parseDecrypt$ = messageSubject.pipe(
    pluck('data'),
    map((rawMessage) =>
      parseJSON<DataTypes>(rawMessage).map((message) => {
        // @ts-ignore
        if (message.valid) {
          const ackMessage = message as { valid: DataTypes }
          // @ts-ignore
          if (ackMessage.valid.method === 'subscribe') {
            track('ws_subscribed')
          }
        }
        return message
      })
    ),
    map(
      (result): Result<DataTypes, Error> =>
        result.andThen((value) =>
          ['iceCandidate', 'offer', 'answer'].includes(value.method)
            ? ok(value)
            : err(Error(`wrong method: ${value.method}`))
        )
    ),
    concatMap((data) =>
      data.asyncAndThen((value) => {
        console.log(`⬇️ received ${value.method}`)
        console.log(value)
        return transformBufferToSealbox(
          Buffer.from(value.encryptedPayload, 'hex')
        )
          .asyncAndThen(({ ciphertextAndAuthTag, iv }) =>
            decrypt(ciphertextAndAuthTag, encryptionKey, iv)
          )
          .andThen(
            (decrypted): Result<DataTypes['payload'], Error> =>
              parseJSON<DataTypes['payload']>(decrypted.toString('utf8'))
          )
          .map(
            (payload) =>
              ({
                ...dissoc('encryptedPayload', value),
                payload,
              } as DataTypes)
          )
      })
    ),
    map((res) => res.isOk() && res.value),
    filter((res) => !!res),
    share()
  )
}
