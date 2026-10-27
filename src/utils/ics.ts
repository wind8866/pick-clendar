import type { ExportItem, FestivalConfig } from '@/types'
import { icsLocal, icsStamp, zoned } from '@/utils/time'

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

function foldLine(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    if (bytes + size > 74) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += char
    bytes += size
  }
  if (current) parts.push(current)
  return parts.map((part, index) => (index === 0 ? part : ` ${part}`)).join('\r\n')
}

export function buildIcs(config: FestivalConfig, items: ExportItem[]): string {
  const tz = config.timeZone
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//calendar-pick//ZH-CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(config.name)}`,
    `X-WR-TIMEZONE:${tz}`,
    'BEGIN:VTIMEZONE',
    `TZID:${tz}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0800',
    'TZOFFSETTO:+0800',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]

  const stamp = icsStamp()
  const location = [config.venue, config.venueAddress].filter(Boolean).join('，')

  for (const item of items) {
    const start = zoned(item.event.start, tz)
    const end = zoned(item.end, tz)
    const descriptionParts = [item.description]
    if (item.travelTime > 0) descriptionParts.push(`路程：${item.travelTime} 分钟`)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${config.id}-${item.event.id}@calendar-pick`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${tz}:${icsLocal(start)}`,
      `DTEND;TZID=${tz}:${icsLocal(end)}`,
      `SUMMARY:${escapeText(`${item.event.titlePrefix ?? ''}${item.event.title}`)}`,
      `DESCRIPTION:${escapeText(descriptionParts.join('\n'))}`,
    )
    if (location) lines.push(`LOCATION:${escapeText(location)}`)
    if (item.event.url) lines.push(`URL:${item.event.url}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')

  return lines.map(foldLine).join('\r\n') + '\r\n'
}
