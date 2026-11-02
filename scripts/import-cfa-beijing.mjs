// 从 doc/data/cfa-beijing.json 生成北京日历（小西天 + 百子湾）的 raw 配置。
//
// 数据口径（见 doc/calendar-cfa-beijing.ics.md）：
//   - 只取 2026-11-01 及以后的场次；
//   - 影厅写入 location，用「小西天 1号厅 / 小西天 2号厅 / 百子湾 1号厅」区分，
//     不额外增加「场馆」筛选维度；
//   - 有活动（have_activity / activity）时加 🎉，描述追加活动文案；
//   - 票价、评分、海报、购票链接不展示。
//
// 用法：node scripts/import-cfa-beijing.mjs

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INPUT = path.join(ROOT, 'doc/data/cfa-beijing.json')
const OUTPUT = path.join(ROOT, 'src/data/raw/cfa-beijing.raw.json')

const FROM_DATE = '2026-11-01'
const TIME_ZONE = 'Asia/Shanghai'
const UTC_OFFSET = '+08:00'
const HEADER_ID = 'cfa-beijing-header'

const META = {
  schemaVersion: 2,
  id: 'cfa-beijing',
  name: '中国电影资料馆',
  city: '北京',
  venue: '小西天艺术影院｜百子湾艺术影院',
  venueAddress: '',
  timeZone: TIME_ZONE,
  siteOrigin: 'https://cal.wind8866.top',
  itemNoun: '部影片',
  defaultView: 'month',
  theme: {
    background: '#ffefec',
    primary: '#EE3E36',
    secondary: '#E4B24A',
  },
  labels: {
    featured: '映后交流',
    sameTitle: '同片场次',
  },
  adjacency: {
    normalMinutes: 60,
    featuredMinutes: 120,
  },
}

const HALL_ALIASES = [
  ['小西天艺术影院', '小西天'],
  ['百子湾艺术影院', '百子湾'],
]

function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hallOf(cinema) {
  let label = cleanText(cinema)
  for (const [full, short] of HALL_ALIASES) {
    label = label.replace(full, short)
  }
  return label.replace(/\s+/g, ' ').trim()
}

function toStart(value) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return ''
  return `${value.replace(' ', 'T')}${UTC_OFFSET}`
}

function buildDescription(screen, hall) {
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

  const hall = hallOf(screen.screen_cinema)
  const activity = cleanText(screen.activity)
  const hasActivity = screen.have_activity === 'true' || Boolean(activity)
  const year = Number(screen.film_year)

  const event = {
    id: `cfa-${screen.id}`,
    title: hasActivity ? `🎉${title}` : title,
    start,
    durationMinutes: duration,
    description: buildDescription(screen, hall),
    url: '',
  }
  if (hall) event.location = hall
  if (Number.isFinite(year) && year > 0) event.year = year
  if (hasActivity) event.postScreening = true
  return event
}

async function main() {
  const data = JSON.parse(await readFile(INPUT, 'utf8'))
  const screens = Array.isArray(data.screens) ? data.screens : []
  if (!screens.length) {
    console.error(`没有场次数据：${INPUT}`)
    process.exit(1)
  }

  const seen = new Set()
  const events = []
  for (const screen of screens) {
    if (String(screen.screen_start_time ?? '') < FROM_DATE) continue
    if (seen.has(screen.id)) continue
    seen.add(screen.id)
    const event = toEvent(screen)
    if (event) events.push(event)
  }

  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  if (!events.length) {
    console.error(`没有 ${FROM_DATE} 及以后的场次`)
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
    title: '📅中国电影资料馆-北京',
    start: `${first.start.slice(0, 10)}T09:00:00${UTC_OFFSET}`,
    durationMinutes: 30,
    description: [
      '中国电影资料馆 · 北京（小西天 / 百子湾）排片日历',
      `${first.start.slice(0, 10)} – ${lastEndLocal}`,
      '',
      '数据来源：中国电影资料馆官方排片（doc/data/cfa.json）',
      '纠错反馈：待补充',
    ].join('\n'),
  }

  const config = {
    meta: {
      ...META,
      initialDate: first.start.slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    },
    events: [header, ...events],
  }

  await writeFile(OUTPUT, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

  const halls = new Set(events.map((event) => event.location).filter(Boolean))
  const activities = events.filter((event) => event.postScreening).length
  console.log(
    `generated ${path.relative(ROOT, OUTPUT)}：${events.length} 场 / ${halls.size} 个厅 / ` +
      `${activities} 场活动 / ${first.start.slice(0, 10)} – ${lastEndLocal}`,
  )
  console.log(`影厅：${[...halls].join('、')}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
