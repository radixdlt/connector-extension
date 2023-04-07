import { config } from 'config'
import { Logger } from 'tslog'

export type AppLogger = typeof logger
export const logger = new Logger({
  prettyLogTemplate: '{{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t',
  minLevel: config.logLevel,
})
