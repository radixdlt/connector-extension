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
      logger.debug(`🔐 setting connectionPassword`)
      signalingSubjects.wsConnectionPasswordSubject.next(
        Buffer.from(connectionPassword, 'hex')
      )
      signalingSubjects.wsAutoConnect.next(true)
    }
    return undefined
  })
