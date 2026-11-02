// 把 cfa.json（中国电影资料馆排片接口导出）转换成 raw 配置。
//
// 注意：cfa.json 在「10 月 / 11 月两段 day 列表拼接处」少了一个 ]，整体不是合法 JSON，
// 所以这里不整体 JSON.parse，而是用括号匹配逐个提取 screen 对象，再按影院筛选。
// 如果以后能拿到合法 JSON，这个脚本同样可用（不影响）。
//
// 用法：
//   node scripts/import-cfa.mjs [输入文件]
// 默认输入：doc/data/cfa.json
// 输出：src/data/raw/cfa202611.raw.json
//
// 只保留 screen_cinema 以「小西天艺术影院」开头的场次（1 号厅 + 2 号厅）。
// 字段映射：
//   show_name         -> title（有活动时加 🎉 前缀，由 generate-calendar 拆成 titlePrefix）
//   screen_start_time -> start（补 +08:00）
//   screen_time_len   -> durationMinutes
//   film_year/area/type + 厅号 -> description（首行「1957年 美国 剧情 · 1号厅」，有活动再加一行）
//   have_activity/activity -> postScreening + 活动文案
//   id                -> 场次 id（显式 id，改期也不会丢本地已选）

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INPUT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'doc/data/cfa.json')
const OUTPUT = path.join(ROOT, 'src/data/raw/cfa202611.raw.json')

const CINEMA = '小西天艺术影院'
const TIME_ZONE = 'Asia/Shanghai'
const UTC_OFFSET = '+08:00'
const CALENDAR_ID = 'cfa202611'
const SITE_ORIGIN = 'https://cal.wind8866.top'
const HEADER_ID = 'cfa202611-header'

const META = {
  schemaVersion: 2,
  id: CALENDAR_ID,
  name: '中国电影资料馆',
  city: '北京',
  venue: '小西天艺术影院',
  venueAddress: '北京市海淀区小西天文慧园路3号',
  timeZone: TIME_ZONE,
  siteOrigin: SITE_ORIGIN,
  itemNoun: '场',
  defaultView: 'month',
  theme: {
    background: '#E9E1D2',
    primary: '#2C4640',
    secondary: '#C09A5B',
  },
  labels: {
    featured: '活动场',
    sameTitle: '同片场次',
  },
  adjacency: {
    normalMinutes: 60,
    featuredMinutes: 120,
  },
}

function extractScreenObjects(text) {
  const screens = []
  const re = /\{\s*"id":\s*\d+/g
  let match
  while ((match = re.exec(text)) !== null) {
    const start = match.index
    let depth = 0
    let inString = false
    let escaped = false
    let end = -1

    for (let i = start; i < text.length; i += 1) {
      const ch = text[i]
      if (inString) {
        if (escaped) escaped = false
        else if (ch === '\\') escaped = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') inString = true
      else if (ch === '{') depth += 1
      else if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }

    if (end === -1) break
    try {
      screens.push(JSON.parse(text.slice(start, end + 1)))
    } catch (error) {
      console.warn(`跳过无法解析的场次对象（偏移 ${start}）：${error.message}`)
    }
    re.lastIndex = end + 1
  }
  return screens
}

function toStart(value) {
  // "2026-10-29 18:30:00" -> "2026-10-29T18:30:00+08:00"
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return ''
  return `${value.replace(' ', 'T')}${UTC_OFFSET}`
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hallOf(screen) {
  return cleanText(String(screen.screen_cinema).slice(CINEMA.length))
}

function buildDescription(screen) {
  const hall = hallOf(screen)
  const year = Number(screen.film_year)
  const head = [
    Number.isFinite(year) && year > 0 ? `${year}年` : '',
    cleanText(screen.film_area),
    cleanText(screen.film_type),
  ]
    .filter(Boolean)
    .join(' ')

  const lines = [hall ? `${head} · ${hall}` : head].filter(Boolean)
  const activity = cleanText(screen.activity)
  if (activity) lines.push(activity)
  return lines.join('\n')
}

function toEvent(screen) {
  const start = toStart(String(screen.screen_start_time ?? ''))
  const duration = Number(screen.screen_time_len)
  const title = cleanText(screen.show_name)
  if (!start || !title || !Number.isFinite(duration) || duration <= 0) return null

  const activity = cleanText(screen.activity)
  const hasActivity = screen.have_activity === 'true' || Boolean(activity)
  const year = Number(screen.film_year)

  const event = {
    id: `cfa-${screen.id}`,
    title: hasActivity ? `🎉${title}` : title,
    start,
    durationMinutes: duration,
    description: buildDescription(screen),
    url: '',
  }
  const hall = hallOf(screen)
  if (hall) event.location = hall
  if (Number.isFinite(year) && year > 0) event.year = year
  if (hasActivity) event.postScreening = true
  return event
}

async function main() {
  const text = await readFile(INPUT, 'utf8')
  const all = extractScreenObjects(text)
  const seen = new Set()
  const events = []

  for (const screen of all) {
    const cinema = String(screen.screen_cinema ?? '')
    if (!cinema.startsWith(CINEMA)) continue
    if (seen.has(screen.id)) continue
    seen.add(screen.id)
    const event = toEvent(screen)
    if (event) events.push(event)
  }

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  if (!events.length) {
    console.error(`没有找到 ${CINEMA} 的场次，请检查输入文件：${INPUT}`)
    process.exit(1)
  }

  const first = events[0]
  const last = events[events.length - 1]
  const lastEndLocal = new Date(
    new Date(last.start).getTime() + last.durationMinutes * 60_000 + 8 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10)

  const header = {
    kind: 'header',
    id: HEADER_ID,
    title: '📅中国电影资料馆·小西天艺术影院排片日历',
    start: `${first.start.slice(0, 10)}T09:00:00${UTC_OFFSET}`,
    durationMinutes: 30,
    description: [
      '中国电影资料馆 · 小西天艺术影院排片日历',
      `${first.start.slice(0, 10)} – ${lastEndLocal}`,
      '',
      '数据来源：中国电影资料馆官方排片（doc/data/cfa.json）',
      '纠错反馈：待补充',
    ].join('\n'),
  }

  const config = {
    meta: {
      ...META,
      // 周视图展开时从第一场所在日期开始，月视图仍会回到所在周的周一
      initialDate: first.start.slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    },
    events: [header, ...events],
  }

  await writeFile(OUTPUT, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

  const days = new Set(events.map((event) => event.start.slice(0, 10)))
  console.log(
    `generated ${path.relative(ROOT, OUTPUT)}：${events.length} 场 / ${days.size} 天 / ` +
      `${first.start.slice(0, 10)} – ${lastEndLocal}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
