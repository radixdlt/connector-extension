// What the iroh transport's own log lines say about messages and library lines.

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const sizeOf = (value: unknown) => {
  try {
    return JSON.stringify(value)?.length
  } catch (error) {
    return undefined
  }
}

const describedFields = [
  'discriminator',
  'eventType',
  'interactionId',
  'messageId',
] as const

/** A short description of a message for the log: its kind, its ids and its size. */
export const describePayload = (value: unknown) => {
  const description: Record<string, string | number> = {}
  if (isRecord(value))
    for (const field of describedFields) {
      const fieldValue = value[field]
      if (typeof fieldValue === 'string')
        description[field] = fieldValue.slice(0, 100)
    }
  const bytes = sizeOf(value)
  if (bytes !== undefined) description.bytes = bytes
  return description
}

const ipv4Octet = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
// Not part of a longer dotted number or word (versions such as "v1.2.3.4" stay).
const ipv4Pattern = new RegExp(
  `(?<![\\w.])${ipv4Octet}(?:\\.${ipv4Octet}){3}(?!\\w|\\.\\d)`,
  'g',
)
const hexGroup = '[0-9a-f]{1,4}'
// Full (8 groups) or compressed ("::") IPv6 addresses, with an optional zone. Not
// inside a word, so that Rust paths ("iroh::socket") and times ("06:27:04") stay.
const ipv6Pattern = new RegExp(
  `(?<![\\w:])(?:(?:${hexGroup}:){7}${hexGroup}|(?:${hexGroup}(?::${hexGroup}){0,6})?::(?:${hexGroup}(?::${hexGroup}){0,6})?)(?:%[\\w.]+)?(?![\\w:])`,
  'gi',
)

/**
 * Replaces IPv4 and IPv6 addresses in `text` by `<ip>` (ports stay), for log lines
 * of libraries that may mention socket addresses: they are users' IP addresses.
 */
export const maskIpAddresses = (text: string) =>
  text
    // IPv4 first: IPv4-mapped IPv6 addresses (::ffff:203.0.113.7) end with one.
    .replace(ipv4Pattern, '<ip>')
    .replace(ipv6Pattern, (match) =>
      // "::" alone, or hex words around it, are not addresses worth hiding.
      /\d/.test(match) ? '<ip>' : match,
    )
