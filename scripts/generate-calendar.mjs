// 从 raw 源数据生成标准化显示数据（display）。
// raw 位于 src/data/raw/*.raw.json，字段自由（贴近数据源，可含映射说明）；
// 本脚本负责映射/归一化，输出到 src/data/festivals/*.json（运行时唯一标准配置）。
//
// 用法：node scripts/generate-calendar.mjs

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW_DIR = path.join(ROOT, 'src/data/raw')
const OUT_DIR = path.join(ROOT, 'src/data/festivals')

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
  return normalized
}

async function main() {
  const files = (await readdir(RAW_DIR)).filter((f) => f.endsWith('.raw.json'))
  if (!files.length) {
    console.warn(`未找到 raw 数据：${RAW_DIR}`)
    return
  }
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
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
