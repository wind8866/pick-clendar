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

export function toDateKey(iso: string, timeZone: string): string {
  return zoned(iso, timeZone).format('YYYY-MM-DD')
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
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} 分钟`
  if (rest === 0) return `${hours} 小时`
  return `${hours} 小时 ${rest} 分钟`
}

export function formatGap(gapMinutes: number): string {
  if (gapMinutes < 0) return `时间冲突 ${formatDuration(-gapMinutes)}`
  if (gapMinutes === 0) return '无缝衔接'
  return `空档 ${formatDuration(gapMinutes)}`
}

export function minutesFromDayStart(date: Dayjs, dayStart: string): number {
  const [hour, minute] = dayStart.split(':').map(Number)
  return date.hour() * 60 + date.minute() - (hour * 60 + minute)
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

export function icsStamp(): string {
  return dayjs.utc().format('YYYYMMDDTHHmmss') + 'Z'
}

export { dayjs }
