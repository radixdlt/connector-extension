import { createContext, useContext } from 'react'

/**
 * Where the app is shown: the action popup, the side panel, or a page in a tab
 * (the options page).
 */
export type Surface = 'popup' | 'sidePanel' | 'page'

export const SurfaceContext = createContext<Surface>('page')

export const useSurface = () => useContext(SurfaceContext)
