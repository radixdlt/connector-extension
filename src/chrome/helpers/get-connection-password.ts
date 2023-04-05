import { chromeLocalStore } from './chrome-local-store'

export const getConnectionPassword = () =>
  chromeLocalStore
    .getItem('connectionPassword')
    .map(({ connectionPassword }) => connectionPassword)
