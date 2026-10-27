// 从 raw 源数据生成标准化显示数据（display）。
// raw 位于 src/data/raw/*.raw.json，字段自由（贴近数据源，可含映射说明）；
// 本脚本负责映射/归一化，输出到 src/data/festivals/*.json（运行时唯一标准配置），
// 并为每个日历生成订阅用静态 .ics 到 public/subscribe/<id>.ics。
//
// 用法：node scripts/generate-calendar.mjs

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW_DIR = path.join(ROOT, 'src/data/raw')
const OUT_DIR = path.join(ROOT, 'src/data/festivals')
const SUBSCRIBE_DIR = path.join(ROOT, 'public/subscribe')
const QR_DIR = path.join(ROOT, 'public/qrcode')

// 二维码为可选能力：scripts/node_modules 里有 qrcode 时才生成
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

function wallClockAdd(iso, minutes) {
  // 以 +08:00 的墙钟时间做分钟加法，返回 YYYYMMDDTHHMMSS（用于 DTSTART/DTEND 本地时间）
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/)
  const [, y, mo, d, h, mi, s] = m
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
  date.setUTCMinutes(date.getUTCMinutes() + minutes)
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`
}

function composedMeta(event) {
  const parts = []
  if (event.director) parts.push(`导演：${event.director}`)
  if (event.rating !== undefined) {
    const count = event.ratingCount !== undefined ? `（${event.ratingCount} 人评价）` : ''
    parts.push(`${event.rating}${count}`)
  }
  if (event.year !== undefined) parts.push(String(event.year))
  if (event.language) parts.push(event.language)
  return parts.join(' · ')
}

function buildSubscribeIcs(config) {
  const tz = config.timeZone ?? 'Asia/Shanghai'
  const offset = '+0800'
  const lines = [
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
    `TZOFFSETFROM:${offset}`,
    `TZOFFSETTO:${offset}`,
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ]
  const stamp = wallClockAdd(new Date().toISOString(), 0).replace('T', '') + 'Z'
  const location = config.venue || ''

  const events = config.events
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))

  for (const event of events) {
    const title = `${event.titlePrefix ?? ''}${event.title}`
    const summary = event.kind === 'header' ? title : title
    lines.push(
      'BEGIN:VEVENT',
      `UID:${config.id}-${event.id}@calendar-pick`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${tz}:${wallClockAdd(event.start, 0)}`,
      `DTEND;TZID=${tz}:${wallClockAdd(event.start, event.durationMinutes)}`,
      `SUMMARY:${escapeText(summary)}`,
    )
    const desc = event.description || composedMeta(event)
    if (desc) lines.push(`DESCRIPTION:${escapeText(desc)}`)
    if (location) lines.push(`LOCATION:${escapeText(location)}`)
    if (event.url) lines.push(`URL:${event.url}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

async function main() {
  const files = (await readdir(RAW_DIR)).filter((f) => f.endsWith('.raw.json'))
  if (!files.length) {
    console.warn(`未找到 raw 数据：${RAW_DIR}`)
    return
  }
  await mkdir(SUBSCRIBE_DIR, { recursive: true })
  await mkdir(QR_DIR, { recursive: true })
  for (const file of files) {
    const raw = JSON.parse(await readFile(path.join(RAW_DIR, file), 'utf8'))
    const { meta, events } = raw
    const config = {
      ...meta,
      schemaVersion: 2,
      events: (events ?? []).map(normalizeEvent),
    }
    const outName = file.replace('.raw.json', '.json')
    await writeFile(path.join(OUT_DIR, outName), `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    console.log(`generated ${outName}（${config.events.length} events）`)

    const icsName = `${config.id}.ics`
    await writeFile(path.join(SUBSCRIBE_DIR, icsName), buildSubscribeIcs(config), 'utf8')
    console.log(`generated subscribe/${icsName}`)

    // 二维码：扫码跳转到该日程页面
    const shareUrl = meta.shareUrl || `https://cal.wind8866.top/pick/${config.id}`
    if (QRCode) {
      const svg = await QRCode.toString(shareUrl, {
        type: 'svg',
        margin: 1,
        width: 160,
        color: { dark: '#33241d', light: '#ffffff' },
      })
      await writeFile(path.join(QR_DIR, `${config.id}.svg`), svg, 'utf8')
      console.log(`generated qrcode/${config.id}.svg -> ${shareUrl}`)
    } else {
      console.warn('未安装 qrcode，跳过二维码生成')
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
