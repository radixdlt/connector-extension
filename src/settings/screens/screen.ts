import { isDevMode, isPublicRelease } from 'config'

/** Props of every settings screen. `page`: on the options page (full page). */
export type ScreenProps = { page?: boolean }

/** Radix Connect settings: shown in builds with dev tools and non-public ones. */
export const showsRadixConnect = () => !(isPublicRelease && !isDevMode)
