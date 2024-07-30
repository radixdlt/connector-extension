import { ILogObj } from 'tslog'
import { ILogObjMeta } from 'tslog/dist/types/interfaces'

export type Log = ILogObjMeta & ILogObj

export type LogsClient = ReturnType<typeof LogsClient>

export const LogsClient = (
  { maxLogsLength, htmlElementId } = {
    htmlElementId: 'logs',
    maxLogsLength: 1000,
  },
) => {
  let browser: string
  const element = document.getElementById(htmlElementId)
  const logs: string[] = []
  return {
    add: (logObj: Log) => {
      const { _meta, ...rest } = logObj
      browser = (_meta as unknown as { browser: string })?.browser
      const dateTime = new Date(_meta.date)
      const prefix = [
        `[${dateTime.toLocaleTimeString()}.${dateTime.getMilliseconds()}]`,
        _meta.name,
      ]
        .filter(Boolean)
        .join('')

      const log = `[${prefix}] ${Object.values(rest)
        .map((singleLog) =>
          typeof singleLog === 'object'
            ? JSON.stringify(singleLog, null, 2)
            : singleLog,
        )
        .join(' ')}`

      logs.push(log)
      element?.prepend(log)
      element?.prepend(document.createElement('br'))

      if (logs.length > maxLogsLength) {
        logs.shift()
      }
    },
    download: () => {
      const element = document.createElement('a')
      element.setAttribute(
        'href',
        'data:text/plain;charset=utf-8,' +
          encodeURIComponent(`Browser: ${browser}\n\n${logs.join('\n')}`),
      )
      element.setAttribute('download', `connector-extension-${Date.now()}.txt`)
      document.body.appendChild(element)

      element.click()

      document.body.removeChild(element)
    },
    toString: () => {
      return JSON.stringify({
        browser,
        logs,
      })
    },
  }
}
