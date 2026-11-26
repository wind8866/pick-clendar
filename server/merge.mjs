import { createHash } from 'node:crypto'
import { dateKey } from './time.mjs'

export class EmptyIncomingError extends Error {
  constructor(calendarId, futureCount) {
    super(`${calendarId} 本轮没有抓到任何场次，但旧数据还有 ${futureCount} 场，已跳过写入`)
    this.name = 'EmptyIncomingError'
    this.calendarId = calendarId
    this.futureCount = futureCount
  }
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function contentHash(events) {
  return createHash('sha256').update(stableStringify(events)).digest('hex')
}

function sortEvents(events) {
  return events.slice().sort((a, b) => {
    const diff = new Date(a.start).getTime() - new Date(b.start).getTime()
    return diff || String(a.id).localeCompare(String(b.id))
  })
}

function updateHeader(header, configName, firstDate, lastEndDate) {
  const range = `${firstDate} – ${lastEndDate}`
  const lines = String(header.description || '').split('\n')
  const index = lines.findIndex((line) =>
    /^\d{4}-\d{2}-\d{2}\s+–\s+\d{4}-\d{2}-\d{2}$/.test(line.trim()),
  )
  if (index >= 0) lines[index] = range
  else lines.splice(1, 0, range)

  const description = lines
    .join('\n')
    .replace('（doc/data/cfa.json）', '')
    .replace(/数据来源：中国电影资料馆官方排片(?:接口)*/g, '数据来源：中国电影资料馆官方排片接口')

  return {
    ...header,
    kind: 'header',
    description,
  }
}

/**
 * 网页保留完整归档（过去所有场次）；未来窗口用本次抓取结果覆盖。
 * 订阅 ICS 是否滚动由 ics.mjs 再筛，不影响这里。
 */
export function mergeConfig({ seed, previous, incoming, now = new Date() }) {
  const base = previous || seed
  if (!base?.events?.length) throw new Error(`${base?.id || 'calendar'} 缺少 seed 数据`)

  const header = base.events.find((event) => event.kind === 'header')
  const archive = base.events.filter(
    (event) => event.kind !== 'header' && new Date(event.start).getTime() < now.getTime(),
  )
  const futureOld = base.events.filter(
    (event) => event.kind !== 'header' && new Date(event.start).getTime() >= now.getTime(),
  )

  if (!incoming.length && futureOld.length) {
    throw new EmptyIncomingError(base.id, futureOld.length)
  }

  const byId = new Map(archive.map((event) => [event.id, event]))
  for (const event of incoming) byId.set(event.id, event)
  const events = sortEvents([...byId.values()])
  if (!events.length) throw new Error(`${base.id} 合并后没有任何场次`)

  const firstDate = dateKey(events[0].start)
  const last = events[events.length - 1]
  const lastEndDate = dateKey(new Date(last.start).getTime() + last.durationMinutes * 60_000)

  const headerEvent = header
    ? updateHeader(header, base.name, firstDate, lastEndDate)
    : {
        kind: 'header',
        id: `${base.id}-header`,
        title: `📅${base.name}`,
        start: `${firstDate}T09:00:00+08:00`,
        durationMinutes: 30,
        description: [`${base.name}排片日历`, `${firstDate} – ${lastEndDate}`].join('\n'),
      }

  const config = {
    ...base,
    schemaVersion: 2,
    runtime: true,
    initialDate: base.initialDate || firstDate,
    events: [headerEvent, ...events],
  }

  return { config, events }
}
