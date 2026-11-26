const TZ_OFFSET_MS = 8 * 60 * 60 * 1000

/** 把任意时刻转成 Asia/Shanghai 的墙钟字段（中国无夏令时，固定 +08:00） */
export function zonedParts(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const shifted = new Date(date.getTime() + TZ_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  }
}

const pad = (value) => String(value).padStart(2, '0')

/** Asia/Shanghai 日期，YYYY-MM-DD */
export function dateKey(value = new Date()) {
  const p = zonedParts(value)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** Asia/Shanghai 月份，YYYY-MM */
export function monthKey(value = new Date()) {
  const p = zonedParts(value)
  return `${p.year}-${pad(p.month)}`
}

/** 月份加减，month 为 1-based */
export function addMonths(year, month, delta) {
  const total = year * 12 + (month - 1) + delta
  return {
    year: Math.floor(total / 12),
    month: (total % 12 + 12) % 12 + 1,
  }
}

/** Asia/Shanghai 当天 00:00 对应的绝对时刻 */
export function startOfDayInZone(value = new Date()) {
  const p = zonedParts(value)
  return new Date(Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0, 0) - TZ_OFFSET_MS)
}

/** Asia/Shanghai 某月最后一天 23:59:59.999 对应的绝对时刻，month 为 1-based */
export function endOfMonthInZone(year, month) {
  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999) - TZ_OFFSET_MS)
}

/** 在某个绝对时刻基础上减若干天 */
export function daysBefore(value, days) {
  return new Date(value.getTime() - days * 24 * 60 * 60 * 1000)
}

/** 形如 2026-11 */
export function monthLabel(year, month) {
  return `${year}-${pad(month)}`
}
