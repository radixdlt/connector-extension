import { Logger } from 'loglevel'
import { SignalingSubjectsType } from 'connector/signaling/subjects'
import { StorageClientType } from 'connector/storage/storage-client'
import { Buffer } from 'buffer'

export const setupConnectionPassword = (
  getConnectionPassword: StorageClientType['getConnectionPassword'],
  signalingSubjects: SignalingSubjectsType,
  logger: Logger
) =>
  getConnectionPassword().map((connectionPassword) => {
    if (connectionPassword) {
      logger.debug(`🔐 setting connectionPassword`)
      signalingSubjects.wsConnectionPasswordSubject.next(
        Buffer.from(connectionPassword, 'hex')
      )
      signalingSubjects.wsAutoConnect.next(true)
    } else {
      signalingSubjects.wsGenerateConnectionSecretsSubject.next()
    }
    return undefined
  })
