import { sendMessage } from 'chrome/helpers/send-message'
import { createMessage } from 'chrome/messages/create-message'
import { config } from 'config'
import { Logger } from 'tslog'

export type AppLogger = typeof logger

/**
 * Errors as plain data. tslog 4.8 clones logged errors and throws on
 * errors whose `stack` is an accessor, as V8 (Chrome, Node) now defines it: any
 * logged Error, even nested (`{ error: { jsError } }`), made the log call throw.
 */
export const toLoggable = (value: unknown, depth = 0): unknown => {
  if (value instanceof Error) {
    const { code } = value as Error & { code?: unknown }
    return {
      name: value.name,
      message: value.message,
      ...(code !== undefined ? { code } : {}),
      stack: value.stack,
    }
  }
  if (depth > 5 || typeof value !== 'object' || value === null) return value
  if (Array.isArray(value))
    return value.map((item) => toLoggable(item, depth + 1))
  if (Object.getPrototypeOf(value) !== Object.prototype) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      toLoggable(item, depth + 1),
    ]),
  )
}

const loggable = (args: unknown[]) => args.map((arg) => toLoggable(arg))

/** A tslog `Logger` that logs errors; its sub-loggers are of the same class. */
class AppLoggerClass<LogObj> extends Logger<LogObj> {
  public silly(...args: unknown[]) {
    return super.silly(...loggable(args))
  }
  public trace(...args: unknown[]) {
    return super.trace(...loggable(args))
  }
  public debug(...args: unknown[]) {
    return super.debug(...loggable(args))
  }
  public info(...args: unknown[]) {
    return super.info(...loggable(args))
  }
  public warn(...args: unknown[]) {
    return super.warn(...loggable(args))
  }
  public error(...args: unknown[]) {
    return super.error(...loggable(args))
  }
  public fatal(...args: unknown[]) {
    return super.fatal(...loggable(args))
  }
}
export const logger = new AppLoggerClass({
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
