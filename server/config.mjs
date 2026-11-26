import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 本地开发用 .env.cfa.local；生产由 systemd EnvironmentFile 注入，不会被本地文件覆盖 */
const localEnvFile = path.join(ROOT, '.env.cfa.local')
if (existsSync(localEnvFile)) {
  for (const line of readFileSync(localEnvFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

function resolvePath(value, fallback) {
  return path.resolve(ROOT, value?.trim() || fallback)
}

function positiveInt(value, fallback) {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback
}

export const API_BASE = (process.env.CFA_API_BASE || 'https://api.guoyingjiaying.cn').replace(/\/+$/, '')
export const LOGIN_URL = `${API_BASE}/api/login`
export const CALENDAR_URL = `${API_BASE}/api/v3/movie/getCalendar`

/** 运行时数据目录：Nginx 直接托管，不要放任何敏感文件 */
export const RUNTIME_DIR = resolvePath(process.env.RUNTIME_DIR, 'public/runtime')
/** 服务私有状态目录：token 缓存、内容哈希，不能暴露给 Nginx */
export const STATE_DIR = resolvePath(process.env.STATE_DIR, 'server/state')
/** 首次运行时用来补历史场次的 display 配置 */
export const SEED_DIR = resolvePath(process.env.SEED_DIR, 'src/data/festivals')

export const SYNC_INTERVAL_HOURS = positiveInt(process.env.SYNC_INTERVAL_HOURS, 8)
export const FETCH_MONTHS_AHEAD = Math.max(2, positiveInt(process.env.FETCH_MONTHS_AHEAD, 2))
export const FETCH_MAX_MONTHS = Math.max(3, positiveInt(process.env.FETCH_MAX_MONTHS, 6))
/** 订阅日历保留过去几天；网页仍保留完整归档 */
export const ICS_PAST_DAYS = Math.max(0, Number(process.env.ICS_PAST_DAYS ?? 3) || 0)
export const REQUEST_TIMEOUT_MS = positiveInt(process.env.REQUEST_TIMEOUT_MS, 15_000)
export const REQUEST_RETRIES = Math.max(1, positiveInt(process.env.REQUEST_RETRIES, 3))

export const SITE_ORIGIN = (process.env.SITE_ORIGIN || '').replace(/\/+$/, '')

export const CALENDARS = [
  {
    id: 'cfa-beijing',
    venues: [
      { prefix: '小西天艺术影院', short: '小西天' },
      { prefix: '百子湾艺术影院', short: '百子湾' },
    ],
  },
  {
    id: 'cfa-jiangnan',
    venues: [{ prefix: '江南分馆影院', short: '江南' }],
  },
]

export const AUTH = {
  mode: (process.env.CFA_AUTH_MODE || (process.env.CFA_ACCOUNT && process.env.CFA_PASSWORD ? 'auto' : 'manual')).toLowerCase(),
  account: (process.env.CFA_ACCOUNT || '').trim(),
  password: process.env.CFA_PASSWORD || '',
  authorization: (process.env.CFA_AUTHORIZATION || '').trim(),
}

export const ALERT = {
  channel: (process.env.ALERT_CHANNEL || 'log').toLowerCase(),
  barkUrl: (process.env.BARK_URL || '').trim(),
  wecomUrl: (process.env.WECOM_WEBHOOK_URL || '').trim(),
  telegramToken: (process.env.TELEGRAM_BOT_TOKEN || '').trim(),
  telegramChatId: (process.env.TELEGRAM_CHAT_ID || '').trim(),
  webhookUrl: (process.env.ALERT_WEBHOOK_URL || '').trim(),
}

export const APP_HEADERS = {
  Accept: '*/*',
  'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
  'Content-Type': 'application/json',
  'Cb-lang': 'zh-CN',
  'Form-type': 'app',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Html5Plus/1.0 (Immersed/20) uni-app',
}
