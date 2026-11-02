import type { ExportItem, FestivalConfig } from '@/types'
import {
  icsLocal,
  icsOffset,
  icsStamp,
  icsUtc,
  zoneOffsetMinutes,
  zoned,
} from '@/utils/time'

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

/**
 * 依据配置时区与实际场次时间决定导出方式：
 * - 全程同一偏移（如 Asia/Shanghai）：用 TZID + 该偏移的 VTIMEZONE，保留场馆墙钟时间；
 * - 跨夏令时或偏移不一致：退回 UTC（Z），保证任何客户端显示的绝对时刻都正确。
 */
function timePlan(config: FestivalConfig, items: ExportItem[]) {
  const instants = items.flatMap((item) => [item.event.start, item.end])
  const offsets = new Set(instants.map((iso) => zoneOffsetMinutes(iso, config.timeZone)))
  if (offsets.size === 1) {
    return { mode: 'tzid' as const, offset: [...offsets][0] }
  }
  return { mode: 'utc' as const, offset: 0 }
}

export function buildIcs(config: FestivalConfig, items: ExportItem[]): string {
  const tz = config.timeZone
  const plan = timePlan(config, items)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//calendar-pick//ZH-CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(config.name)}`,
    `X-WR-TIMEZONE:${tz}`,
  ]

  if (plan.mode === 'tzid') {
    const offset = icsOffset(plan.offset)
    lines.push(
      'BEGIN:VTIMEZONE',
      `TZID:${tz}`,
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      `TZOFFSETFROM:${offset}`,
      `TZOFFSETTO:${offset}`,
      'END:STANDARD',
      'END:VTIMEZONE',
    )
  }

  const stamp = icsStamp()

  for (const item of items) {
    const descriptionParts = [item.description]
    if (item.travelTime > 0) descriptionParts.push(`行程：${item.travelTime} 分钟`)
    lines.push(
      'BEGIN:VEVENT',
      `UID:${config.id}-${item.event.id}@calendar-pick`,
      `DTSTAMP:${stamp}`,
      plan.mode === 'tzid'
        ? `DTSTART;TZID=${tz}:${icsLocal(zoned(item.event.start, tz))}`
        : `DTSTART:${icsUtc(item.event.start)}`,
      plan.mode === 'tzid'
        ? `DTEND;TZID=${tz}:${icsLocal(zoned(item.end, tz))}`
        : `DTEND:${icsUtc(item.end)}`,
      `SUMMARY:${escapeText(`${item.event.titlePrefix ?? ''}${item.event.title}`)}`,
      `DESCRIPTION:${escapeText(descriptionParts.join('\n'))}`,
    )
    if (item.event.url) lines.push(`URL:${item.event.url}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')

  return lines.map(foldLine).join('\r\n') + '\r\n'
}
