import { ICS_PAST_DAYS } from './config.mjs'
import { addMonths, dateKey, daysBefore, endOfMonthInZone, startOfDayInZone, zonedParts } from './time.mjs'

function escapeText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

function foldLine(line) {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts = []
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

function zoneParts(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date)
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: Number(map.hour) % 24,
      minute: Number(map.minute),
      second: Number(map.second),
    }
  } catch {
    return null
  }
}

const pad = (value) => String(value).padStart(2, '0')

function offsetMinutes(iso, timeZone) {
  const parts = zoneParts(iso, timeZone)
  if (!parts) return null
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return Math.round((asUtc - new Date(iso).getTime()) / 60000)
}

function wallClock(iso, timeZone, addMinutes = 0) {
  const date = new Date(new Date(iso).getTime() + addMinutes * 60000)
  const parts = zoneParts(date, timeZone)
  if (!parts) return '19700101T000000'
  return `${parts.year}${pad(parts.month)}${pad(parts.day)}T${pad(parts.hour)}${pad(parts.minute)}${pad(parts.second)}`
}

function utcStamp(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
}

function icsOffset(minutes) {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(Math.round(minutes))
  return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`
}

function composedMeta(event, config) {
  const parts = []
  if (event.year !== undefined) parts.push(`${event.year}年`)
  if (event.director) parts.push(event.director)
  if (event.language) parts.push(event.language)
  const line = parts.join(' ')
  if (config.hallInDescription && event.location) {
    return line ? `${line} · ${event.location}` : event.location
  }
  return line
}

function timePlan(events, timeZone) {
  const offsets = new Set()
  for (const event of events) {
    for (const iso of [
      event.start,
      new Date(new Date(event.start).getTime() + event.durationMinutes * 60000).toISOString(),
    ]) {
      const offset = offsetMinutes(iso, timeZone)
      if (offset === null) return { mode: 'utc' }
      offsets.add(offset)
    }
  }
  if (offsets.size !== 1) return { mode: 'utc' }
  return { mode: 'tzid', offset: [...offsets][0] }
}

export function buildSubscribeIcs(config, events = config.events) {
  const tz = config.timeZone || 'Asia/Shanghai'
  const sorted = events
    .slice()
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  const plan = timePlan(sorted, tz)
  const lines = [
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

  const stamp = utcStamp(new Date().toISOString())

  for (const event of sorted) {
    const title = `${event.titlePrefix ?? ''}${event.title}`
    const uid = event.id.startsWith(`${config.id}-`) ? event.id : `${config.id}-${event.id}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}@calendar-pick`,
      `DTSTAMP:${stamp}`,
      plan.mode === 'tzid'
        ? `DTSTART;TZID=${tz}:${wallClock(event.start, tz)}`
        : `DTSTART:${utcStamp(event.start)}`,
      plan.mode === 'tzid'
        ? `DTEND;TZID=${tz}:${wallClock(event.start, tz, event.durationMinutes)}`
        : `DTEND:${utcStamp(
            new Date(new Date(event.start).getTime() + event.durationMinutes * 60000).toISOString(),
          )}`,
      `SUMMARY:${escapeText(title)}`,
    )
    const desc = event.description || composedMeta(event, config)
    if (desc) lines.push(`DESCRIPTION:${escapeText(desc)}`)
    if (event.url) lines.push(`URL:${event.url}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/**
 * 订阅日历滚动窗口：
 * - 过去 ICS_PAST_DAYS 天（默认 3 天）到“下下月”月底；
 * - 头日程是影展标题提示，作为例外始终保留。
 */
export function rollingIcsEvents(config, now = new Date()) {
  const windowStart = startOfDayInZone(daysBefore(now, ICS_PAST_DAYS))
  const p = zonedParts(now)
  const endMonth = addMonths(p.year, p.month, 2)
  const windowEnd = endOfMonthInZone(endMonth.year, endMonth.month)
  const startMs = windowStart.getTime()
  const endMs = windowEnd.getTime()

  const events = config.events.filter((event) => {
    if (event.kind === 'header') return true
    const start = new Date(event.start).getTime()
    return Number.isFinite(start) && start >= startMs && start <= endMs
  })

  return {
    events,
    windowStart,
    windowEnd,
    windowKey: `${dateKey(windowStart)}_${dateKey(windowEnd)}`,
  }
}
