import { Logger } from 'loglevel'
import { SignalingSubjectsType } from 'signaling/subjects'
import { StorageClientType } from 'storage/storage-client'
import { Buffer } from 'buffer'

export const setupConnectionPassword = (
  getConnectionPassword: StorageClientType['getConnectionPassword'],
  signalingSubjects: SignalingSubjectsType,
  logger: Logger
) =>
  getConnectionPassword().map((connectionPassword) => {
    if (connectionPassword) {
      logger.debug(
        `🔑 found connection password in storage: ${connectionPassword}`
      )
      signalingSubjects.wsConnectionPasswordSubject.next(
        Buffer.from(connectionPassword, 'hex')
      )
      signalingSubjects.wsAutoConnect.next(true)
    }
    // else {
    //   logger.debug(
    //     `🔑 did not find connection password in storage, generating new password`
    //   )
    //   signalingSubjects.wsGenerateConnectionSecretsSubject.next()
    // }
    return undefined
  })
