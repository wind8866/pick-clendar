// 把 doc/data/cfa.json（资料馆排片接口导出）按场馆拆成两份有效 JSON：
//   doc/data/cfa-beijing.json  北京：小西天艺术影院 + 百子湾艺术影院
//   doc/data/jiangnan.json     江南分馆影院
//
// 注意：原 cfa.json 在「10 月 / 11 月两段 day 列表拼接处」少了一个 ]，整体不是合法 JSON，
// 所以这里用括号匹配逐个提取 screen 对象，再按 screen_cinema 前缀分组。
//
// 用法：node scripts/split-cfa.mjs [输入文件]

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const INPUT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'doc/data/cfa.json')
const OUT_DIR = path.join(ROOT, 'doc/data')

const GROUPS = [
  {
    key: 'beijing',
    file: 'cfa-beijing.json',
    city: '北京',
    venues: ['小西天艺术影院', '百子湾艺术影院'],
  },
  {
    key: 'jiangnan',
    file: 'jiangnan.json',
    city: '',
    venues: ['江南分馆影院'],
  },
]

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

function uniqueById(screens) {
  const map = new Map()
  for (const screen of screens) {
    if (!map.has(screen.id)) map.set(screen.id, screen)
  }
  return [...map.values()].sort((a, b) =>
    String(a.screen_start_time).localeCompare(String(b.screen_start_time)),
  )
}

async function main() {
  const text = await readFile(INPUT, 'utf8')
  const all = uniqueById(extractScreenObjects(text))
  if (!all.length) {
    console.error(`没有提取到任何场次，请检查输入文件：${INPUT}`)
    process.exit(1)
  }
  await mkdir(OUT_DIR, { recursive: true })

  const used = new Set()
  for (const group of GROUPS) {
    const screens = all.filter((screen) => {
      const cinema = String(screen.screen_cinema ?? '')
      return group.venues.some((venue) => cinema.startsWith(venue))
    })
    for (const screen of screens) used.add(screen.id)
    if (!screens.length) {
      console.warn(`跳过 ${group.key}：没有匹配 ${group.venues.join(' / ')} 的场次`)
      continue
    }

    const dates = screens.map((screen) => String(screen.screen_start_time).slice(0, 10)).sort()
    const payload = {
      source: path.basename(INPUT),
      group: group.key,
      city: group.city,
      venues: group.venues,
      count: screens.length,
      dateRange: {
        start: dates[0],
        end: dates[dates.length - 1],
      },
      screens,
    }
    await writeFile(path.join(OUT_DIR, group.file), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    console.log(
      `generated doc/data/${group.file}：${screens.length} 场（${dates[0]} – ${dates[dates.length - 1]}）`,
    )
  }

  const rest = all.filter((screen) => !used.has(screen.id))
  if (rest.length) {
    console.warn(`有 ${rest.length} 场未归类：`)
    for (const screen of rest) console.warn(`  ${screen.screen_cinema} | ${screen.show_name}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
