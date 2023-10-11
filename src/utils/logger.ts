import { sendMessage } from 'chrome/helpers/send-message'
import { createMessage } from 'chrome/messages/create-message'
import { config } from 'config'
import { Logger } from 'tslog'

export type AppLogger = typeof logger
export const logger = new Logger({
  prettyLogTemplate: '{{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t',
  prettyLogTimeZone: 'UTC',
  minLevel: config.logLevel,
})

export const offscreenLogger = new Logger({
  prettyLogTemplate: '{{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t',
  prettyLogTimeZone: 'UTC',
  minLevel: config.logLevel,
})

logger.attachTransport((logObj) => {
  sendMessage(createMessage.log(logObj))
})

offscreenLogger.attachTransport((logObj) => {
  sendMessage(createMessage.offscreenLog(logObj))
})
