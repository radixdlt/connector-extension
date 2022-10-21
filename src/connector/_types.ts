export type Status =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'disconnecting'

export type Secrets = {
  encryptionKey: Buffer
  connectionId: Buffer
}

export type PairingState = 'paired' | 'notPaired' | 'loading'
