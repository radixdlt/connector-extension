import { sendMessage } from 'chrome/helpers/send-message'
import { createMessage } from 'chrome/messages/create-message'
import { config } from 'config'
import { Logger } from 'tslog'

export type AppLogger = typeof logger
export const logger = new Logger({
  prettyLogTemplate: '{{hh}}:{{MM}}:{{ss}}:{{ms}} {{name}}',
  prettyLogTimeZone: 'UTC',
  minLevel: config.logLevel,
})

logger.attachTransport((logObj) => {
  try {
    sendMessage(createMessage.log(logObj))
  } catch (error) {
    console.error('Error sending log message', error)
  }
})
