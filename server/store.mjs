import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { RUNTIME_DIR, SEED_DIR, STATE_DIR } from './config.mjs'

export async function ensureDirs() {
  await Promise.all([
    mkdir(path.join(RUNTIME_DIR, 'festivals'), { recursive: true, mode: 0o755 }),
    mkdir(path.join(RUNTIME_DIR, 'subscribe'), { recursive: true, mode: 0o755 }),
    mkdir(STATE_DIR, { recursive: true, mode: 0o700 }),
  ])
}

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

export async function writeJsonAtomic(file, value, { mode = 0o644 } = {}) {
  await mkdir(path.dirname(file), { recursive: true })
  const text = `${JSON.stringify(value, null, 2)}\n`
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, text, { mode })
  await rename(tmp, file)
  await chmod(file, mode).catch(() => {})
}

export async function writeTextAtomic(file, text, { mode = 0o644 } = {}) {
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, text, { mode })
  await rename(tmp, file)
  await chmod(file, mode).catch(() => {})
}

export function seedPath(id) {
  return path.join(SEED_DIR, `${id}.json`)
}

export function runtimePath(id) {
  return path.join(RUNTIME_DIR, 'festivals', `${id}.json`)
}

export function icsPath(id) {
  return path.join(RUNTIME_DIR, 'subscribe', `${id}.ics`)
}

export function statusPath() {
  return path.join(RUNTIME_DIR, 'status.json')
}

export async function loadSeed(id) {
  const config = await readJson(seedPath(id))
  if (!config?.events?.length) {
    throw new Error(`缺少 seed 配置：${seedPath(id)}`)
  }
  return config
}

export async function loadRuntime(id) {
  return readJson(runtimePath(id))
}

export async function writeCalendar(config) {
  await writeJsonAtomic(runtimePath(config.id), config)
}

export async function writeIcs(id, content) {
  await writeTextAtomic(icsPath(id), content)
}

function metadataOf(config) {
  return {
    id: config.id,
    name: config.name,
    city: config.city,
    venue: config.venue,
    venueAddress: config.venueAddress,
    timeZone: config.timeZone,
    initialDate: config.initialDate,
    itemNoun: config.itemNoun,
    order: config.order,
    updatedAt: config.updatedAt,
    theme: config.theme,
    cover: config.cover,
    labels: config.labels,
    adjacency: config.adjacency,
    hallColors: config.hallColors,
    hallInDescription: config.hallInDescription,
    defaultView: config.defaultView,
    runtime: true,
  }
}

export async function writeIndex(configs) {
  const list = configs
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id.localeCompare(b.id))
    .map(metadataOf)
  await writeJsonAtomic(path.join(RUNTIME_DIR, 'festivals', 'index.json'), list)
}

export async function writeStatus(status) {
  await writeJsonAtomic(statusPath(), status)
}

export async function loadSyncState() {
  const state = await readJson(path.join(STATE_DIR, 'sync.json'), null)
  return state && typeof state === 'object' ? state : { calendars: {} }
}

export async function saveSyncState(state) {
  await writeJsonAtomic(path.join(STATE_DIR, 'sync.json'), state, { mode: 0o600 })
}
