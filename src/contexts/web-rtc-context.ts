import { BootstrapApplicationType } from 'bootstrap-application'
import { createContext } from 'react'

export const WebRtcContext = createContext<BootstrapApplicationType | null>(
  null
)
