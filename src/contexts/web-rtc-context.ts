import { BootstrapType } from 'bootstrap/bootstrap'
import { createContext } from 'react'

export const WebRtcContext = createContext<BootstrapType | null>(null)
