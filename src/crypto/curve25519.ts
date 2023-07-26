import ec from 'elliptic'

// eslint-disable-next-line new-cap
export const curve25519 = new ec.eddsa('ed25519')
