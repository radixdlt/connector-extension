import { config } from 'config'
import { Logger } from 'tslog'

export const logger = new Logger({
  prettyLogTemplate: '{{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t',
  minLevel: config.logLevel,
})
