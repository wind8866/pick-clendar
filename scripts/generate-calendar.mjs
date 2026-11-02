// 从 raw 源数据生成标准化显示数据（display）。
// raw 位于 src/data/raw/*.raw.json，字段自由（贴近数据源，可含映射说明）；
// 本脚本负责映射/归一化，输出到 src/data/festivals/*.json（运行时唯一标准配置），
// 并为每个日历生成订阅用静态 .ics 到 public/subscribe/<id>.ics。
//
// 用法：node scripts/generate-calendar.mjs
//
// 站点域名：优先读环境变量 SITE_ORIGIN，其次 raw meta.siteOrigin，用于生成二维码。
// 时区：全部按 config.timeZone 推导，不再写死 +0800。

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW_DIR = path.join(ROOT, 'src/data/raw')
const OUT_DIR = path.join(ROOT, 'src/data/festivals')
const SUBSCRIBE_DIR = path.join(ROOT, 'public/subscribe')
const QR_DIR = path.join(ROOT, 'public/qrcode')

const DEFAULT_TIME_ZONE = 'Asia/Shanghai'
const DEFAULT_ITEM_NOUN = '项'
const DEFAULT_FEATURED_LABEL = '映后交流'
const DEFAULT_SAME_TITLE_LABEL = '同片场次'

// 二维码依赖 qrcode（package.json devDependencies）；缺失时只跳过二维码，不阻塞生成
let QRCode = null
try {
  QRCode = (await import('qrcode')).default
} catch {
  QRCode = null
}

// 标题前导 emoji/符号（如 🎉）作为 titlePrefix 拆出
const EMOJI_PREFIX_RE =
  /^([\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]+)/u

function splitPrefix(title) {
  const match = title.match(EMOJI_PREFIX_RE)
  if (match) {
    return { title: title.slice(match[0].length), titlePrefix: match[0] }
  }
  return { title, titlePrefix: undefined }
}

function eventId(start) {
  // 2026-10-29T19:30:00+08:00 -> 20261029-1930
  const date = start.slice(0, 10).replaceAll('-', '')
  const time = start.slice(11, 16).replace(':', '')
  return `${date}-${time}`
}

function normalizeEvent(event) {
  const { title, titlePrefix } = splitPrefix(event.title)
  const normalized = {
    id: eventId(event.start),
    title,
    start: event.start,
    durationMinutes: event.durationMinutes,
    description: event.description ?? '',
    url: event.url ?? '',
  }
  if (titlePrefix) normalized.titlePrefix = titlePrefix
  if (event.director) normalized.director = event.director
  if (event.year !== undefined) normalized.year = event.year
  if (event.language) normalized.language = event.language
  if (event.rating !== undefined) normalized.rating = event.rating
  if (event.ratingCount !== undefined) normalized.ratingCount = event.ratingCount
  if (event.weekDesc) normalized.weekDesc = event.weekDesc
  if (event.postScreening) normalized.postScreening = true
  if (event.kind) normalized.kind = event.kind
  return normalized
}

// ---- 时区工具（纯 Intl 实现，不依赖运行环境的本地时区）----

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

/** 该瞬间在目标时区的偏移（分钟）；解析失败返回 null */
function offsetMinutes(iso, timeZone) {
  const parts = zoneParts(iso, timeZone)
  if (!parts) return null
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  return Math.round((asUtc - new Date(iso).getTime()) / 60000)
}

/** 该瞬间在目标时区的墙钟时间，YYYYMMDDTHHMMSS */
function wallClock(iso, timeZone, addMinutes = 0) {
  const date = new Date(new Date(iso).getTime() + addMinutes * 60000)
  const parts = zoneParts(date, timeZone)
  if (!parts) return '19700101T000000'
  return `${parts.year}${pad(parts.month)}${pad(parts.day)}T${pad(parts.hour)}${pad(parts.minute)}${pad(parts.second)}`
}

/** 该瞬间在目标时区的日期，YYYY-MM-DD */
function wallDate(iso, timeZone) {
  const parts = zoneParts(iso, timeZone)
  if (!parts) return ''
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

function utcStamp(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
}

function icsOffset(minutes) {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(Math.round(minutes))
  return `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`
}

// ---- 订阅日历 .ics 生成（纯 JS）----

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

function composedMeta(event) {
  // 与页面导出的 .ics 保持一致：年代 / 导演 / 语言，不含评分与影院信息
  const parts = []
  if (event.year !== undefined) parts.push(`${event.year}年`)
  if (event.director) parts.push(event.director)
  if (event.language) parts.push(event.language)
  return parts.join(' ')
}

/**
 * 与页面导出同一口径：全程同一偏移时用 TZID + 该偏移的 VTIMEZONE；
 * 跨夏令时/偏移不一致时退回 UTC，保证任何客户端显示的绝对时刻正确。
 */
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

function buildSubscribeIcs(config) {
  const tz = config.timeZone
  const events = config.events
    .slice()
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  const plan = timePlan(events, tz)
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

  for (const event of events) {
    const title = `${event.titlePrefix ?? ''}${event.title}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${config.id}-${event.id}@calendar-pick`,
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
    const desc = event.description || composedMeta(event)
    if (desc) lines.push(`DESCRIPTION:${escapeText(desc)}`)
    if (event.url) lines.push(`URL:${event.url}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

function buildConfig(meta, events) {
  const timeZone = meta.timeZone?.trim() || DEFAULT_TIME_ZONE
  const normalized = (events ?? []).map(normalizeEvent)
  const first = normalized
    .filter((event) => event.kind !== 'header')
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0]
  const initialDate =
    meta.initialDate?.trim() ||
    (first ? wallDate(first.start, timeZone) : wallDate(new Date().toISOString(), timeZone))

  return {
    ...meta,
    schemaVersion: 2,
    timeZone,
    initialDate,
    itemNoun: meta.itemNoun?.trim() || DEFAULT_ITEM_NOUN,
    subscribeUrl: meta.subscribeUrl?.trim() || undefined,
    labels: {
      featured: DEFAULT_FEATURED_LABEL,
      sameTitle: DEFAULT_SAME_TITLE_LABEL,
      ...(meta.labels ?? {}),
    },
    events: normalized,
  }
}

async function main() {
  const files = (await readdir(RAW_DIR)).filter((f) => f.endsWith('.raw.json'))
  if (!files.length) {
    console.warn(`未找到 raw 数据：${RAW_DIR}`)
    return
  }
  await mkdir(SUBSCRIBE_DIR, { recursive: true })
  await mkdir(QR_DIR, { recursive: true })

  const seenIds = new Set()

  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(RAW_DIR, file), 'utf8'))
    const config = buildConfig(raw.meta ?? {}, raw.events)

    if (!config.id) {
      console.warn(`跳过 ${file}：meta.id 为空`)
      continue
    }
    if (seenIds.has(config.id)) {
      console.warn(`跳过 ${file}：日历 id 重复（${config.id}）`)
      continue
    }
    seenIds.add(config.id)

    const outName = file.replace('.raw.json', '.json')
    if (outName !== `${config.id}.json`) {
      console.warn(`提示：${file} 的 id 为 ${config.id}，建议与文件名保持一致`)
    }
    await writeFile(path.join(OUT_DIR, outName), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    console.log(`generated ${outName}（${config.events.length} events）`)

    const icsName = `${config.id}.ics`
    await writeFile(path.join(SUBSCRIBE_DIR, icsName), buildSubscribeIcs(config), 'utf8')
    console.log(`generated subscribe/${icsName}`)

    // 二维码：扫码跳转到该日历页面，域名来自 SITE_ORIGIN / meta.siteOrigin
    const siteOrigin = (process.env.SITE_ORIGIN || config.siteOrigin || '').replace(/\/+$/, '')
    const shareUrl = config.shareUrl?.trim() || (siteOrigin ? `${siteOrigin}/pick/${config.id}` : '')
    if (!QRCode) {
      console.warn(`跳过二维码：未安装 qrcode（pnpm add -D qrcode）`)
    } else if (!shareUrl) {
      console.warn(`跳过二维码：${config.id} 缺少 siteOrigin / shareUrl`)
    } else {
      const svg = await QRCode.toString(shareUrl, {
        type: 'svg',
        margin: 1,
        width: 160,
        color: { dark: '#33241d', light: '#ffffff' },
      })
      await writeFile(path.join(QR_DIR, `${config.id}.svg`), svg, 'utf8')
      console.log(`generated qrcode/${config.id}.svg -> ${shareUrl}`)
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
