import loglevel from 'loglevel'
import { SignalingSubjectsType } from 'signaling/subjects'
import { StorageClientType } from 'storage/storage-client'
import { Buffer } from 'buffer'

export const setupConnectionPassword = (
  getConnectionPassword: StorageClientType['getConnectionPassword'],
  signalingSubjects: SignalingSubjectsType
) =>
  getConnectionPassword().map((connectionPassword) => {
    if (connectionPassword) {
      loglevel.debug(
        `🔑 found connection password in storage: ${connectionPassword}`
      )
      signalingSubjects.wsConnectionPasswordSubject.next(
        Buffer.from(connectionPassword, 'hex')
      )
      signalingSubjects.wsAutoConnect.next(true)
    } else {
      loglevel.debug(
        `🔑 did not find connection password in storage, generating new password`
      )
      signalingSubjects.wsGenerateConnectionSecretsSubject.next()
    }
    return undefined
  })
