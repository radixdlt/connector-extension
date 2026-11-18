import type { ILogObj } from 'tslog'
import type { ILogObjMeta } from 'tslog/dist/types/interfaces'

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
      // Level and full logger name (e.g. offScreen:[WCC]:iroh, after which a
      // `wallet=<short key>` prefix names the link), so that exported logs tell which
      // link and transport a line is about.
      const name = [...(_meta.parentNames ?? []), _meta.name]
        .filter(Boolean)
        .join(':')
      const prefix = [
        `${dateTime.toLocaleTimeString()}.${dateTime.getMilliseconds()}`,
        _meta.logLevelName,
        name,
      ]
        .filter(Boolean)
        .join(' ')

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
    /** `header`: text written before the logs (e.g. the connection diagnostics). */
    download: (header?: string) => {
      const element = document.createElement('a')
      const sections = [
        `Browser: ${browser}`,
        header?.trimEnd(),
        logs.join('\n'),
      ]
      element.setAttribute(
        'href',
        'data:text/plain;charset=utf-8,' +
          encodeURIComponent(sections.filter(Boolean).join('\n\n')),
      )
      element.setAttribute('download', `connector-extension-${Date.now()}.txt`)
      document.body.appendChild(element)

      element.click()

      document.body.removeChild(element)
    },
    toString: () =>
      JSON.stringify({
        browser,
        logs,
      }),
  }
}
