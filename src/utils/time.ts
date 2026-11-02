import dayjs, { type Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import isoWeek from 'dayjs/plugin/isoWeek'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isoWeek)
dayjs.extend(customParseFormat)

export const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const
export const WEEKDAYS_MON = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] as const
export const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'] as const

export function zoned(iso: string, timeZone: string): Dayjs {
  return dayjs(iso).tz(timeZone)
}

/**
 * 用目标时区解释一个「只有日期」的字符串，取当天正午作为安全锚点。
 * 不要写 `${date}T12:00:00+08:00`：偏移写死后，换时区会把日期整体挪走一天。
 */
export function dateInZone(date: string, timeZone: string): Dayjs {
  return dayjs.tz(`${date.slice(0, 10)}T12:00:00`, timeZone)
}

export function toDateKey(iso: string, timeZone: string): string {
  return zoned(iso, timeZone).format('YYYY-MM-DD')
}

/** 按真实时间点比较，避免 ISO 字符串带不同偏移时 localeCompare 排错 */
export function compareStart(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime()
}

/** 该瞬间在目标时区的偏移（分钟），用于判断导出是否需要 VTIMEZONE */
export function zoneOffsetMinutes(iso: string, timeZone: string): number {
  return zoned(iso, timeZone).utcOffset()
}

export function eventEnd(iso: string, durationMinutes: number, timeZone: string): Dayjs {
  return zoned(iso, timeZone).add(durationMinutes, 'minute')
}

export function startOfWeek(date: Dayjs): Dayjs {
  return date.startOf('isoWeek')
}

export function weekdayLabel(date: Dayjs): string {
  return WEEKDAYS[date.day()]
}

export function hm(date: Dayjs): string {
  return date.format('HH:mm')
}

export function dateTimeLabel(date: Dayjs): string {
  return `${date.format('YYYY-MM-DD')} ${weekdayLabel(date)} ${date.format('HH:mm')}`
}

export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  return `${minutes} 分钟`
}

export function formatGap(gapMinutes: number): string {
  if (gapMinutes < 0) return `时间冲突 ${formatDuration(-gapMinutes)}`
  return `间隔 ${formatDuration(gapMinutes)}`
}

export function rangeLabel(start: Dayjs, end: Dayjs): string {
  const sameYear = start.year() === end.year()
  const sameMonth = sameYear && start.month() === end.month()
  if (sameMonth) {
    return `${start.format('YYYY年M月D日')} – ${end.format('D日')}`
  }
  if (sameYear) {
    return `${start.format('YYYY年M月D日')} – ${end.format('M月D日')}`
  }
  return `${start.format('YYYY年M月D日')} – ${end.format('YYYY年M月D日')}`
}

export function browserTimestamp(): string {
  return dayjs().format('YYYYMMDD-HHmmss')
}

export function icsLocal(date: Dayjs): string {
  return date.format('YYYYMMDDTHHmmss')
}

/** 绝对时间（UTC）形式，带 Z 后缀，用于跨时区/夏令时安全回退 */
export function icsUtc(iso: string): string {
  return `${dayjs(iso).utc().format('YYYYMMDDTHHmmss')}Z`
}

/** 分钟偏移转 ICS 的 ±HHMM */
export function icsOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(Math.round(minutes))
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${sign}${hh}${mm}`
}

export function icsStamp(): string {
  return dayjs.utc().format('YYYYMMDDTHHmmss') + 'Z'
}

export { dayjs }
