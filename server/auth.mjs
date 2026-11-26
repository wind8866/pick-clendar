import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { APP_HEADERS, AUTH, LOGIN_URL, STATE_DIR } from './config.mjs'
import { requestJson } from './http.mjs'

const AUTH_FILE = path.join(STATE_DIR, 'auth.json')
const REFRESH_BEFORE_DAYS = 3
const LOGIN_RETRIES = 2

let cached = null
let cacheLoaded = false

export class AuthError extends Error {}

function tokenOf(value) {
  return String(value || '')
    .replace(/^Bearer\s+/i, '')
    .trim()
}

/** 解析 JWT payload；只用于读取 exp，不做签名校验 */
export function decodeToken(value) {
  const token = tokenOf(value)
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    return payload && typeof payload === 'object' ? payload : null
  } catch {
    return null
  }
}

export function authorizationInfo(value) {
  const token = tokenOf(value)
  if (!token) return null
  const payload = decodeToken(token)
  const expiresAt = payload?.exp ? new Date(payload.exp * 1000) : null
  return {
    authorization: `Bearer ${token}`,
    expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
  }
}

function isFresh(info, days = REFRESH_BEFORE_DAYS) {
  if (!info?.authorization) return false
  if (!info.expiresAt) return false
  return info.expiresAt.getTime() > Date.now() + days * 24 * 60 * 60 * 1000
}

function authError(message) {
  return new AuthError(message)
}

async function readCache() {
  if (cacheLoaded) return cached
  cacheLoaded = true
  try {
    const raw = JSON.parse(await readFile(AUTH_FILE, 'utf8'))
    const info = authorizationInfo(raw.authorization)
    if (info) {
      cached = {
        ...info,
        source: raw.source || 'cache',
        updatedAt: raw.updatedAt || null,
      }
      return cached
    }
  } catch {
    // 没有缓存或缓存损坏，交给登录流程
  }
  return null
}

async function saveCache(info) {
  await mkdir(STATE_DIR, { recursive: true, mode: 0o700 })
  const payload = {
    authorization: info.authorization,
    expiresAt: info.expiresAt ? info.expiresAt.toISOString() : null,
    source: info.source,
    updatedAt: new Date().toISOString(),
  }
  const tmp = `${AUTH_FILE}.${process.pid}.tmp`
  await writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 })
  await rename(tmp, AUTH_FILE)
  await chmod(AUTH_FILE, 0o600).catch(() => {})
  cached = { ...info, updatedAt: payload.updatedAt }
  return cached
}

/** 用账号密码换新 token；调用方负责决定是否重试 */
export async function login() {
  if (!AUTH.account || !AUTH.password) {
    throw authError('自动登录缺少 CFA_ACCOUNT / CFA_PASSWORD')
  }

  const { data, status } = await requestJson(LOGIN_URL, {
    method: 'POST',
    headers: APP_HEADERS,
    body: { account: AUTH.account, password: AUTH.password },
    retries: LOGIN_RETRIES,
  })

  if (data?.status !== 200 || !data?.data?.token) {
    throw authError(`登录失败：${data?.msg || `HTTP ${status}`}`)
  }

  const info = authorizationInfo(data.data.token)
  if (!info) throw authError('登录成功但没有解析到 token')

  const expiresTime = data.data.expires_time ? new Date(data.data.expires_time) : null
  if (!info.expiresAt && expiresTime && !Number.isNaN(expiresTime.getTime())) {
    info.expiresAt = expiresTime
  }
  info.source = 'login'
  console.log(`[auth] 登录成功，token 到期 ${info.expiresAt?.toISOString() ?? '未知'}`)
  return saveCache(info)
}

function manualInfo() {
  return AUTH.authorization ? authorizationInfo(AUTH.authorization) : null
}

/**
 * 获取当前可用 token：
 * - 缓存剩余超过 3 天直接复用，避免频繁登录；
 * - auto 模式登录；登录失败时如果 env / 缓存里还有可用 token 就兜底；
 * - manual 模式只用 env / 缓存。
 */
export async function getAuthorization() {
  const cache = await readCache()
  if (isFresh(cache)) return cache

  if (AUTH.mode !== 'auto') {
    const manual = manualInfo()
    if (isFresh(manual, 0)) {
      cached = { ...manual, source: 'env' }
      return cached
    }
    if (cache?.authorization && cache.expiresAt?.getTime() > Date.now()) return cache
    throw authError('手动 token 缺失或已过期，请更新 CFA_AUTHORIZATION')
  }

  try {
    return await login()
  } catch (error) {
    const manual = manualInfo()
    if (isFresh(manual, 0)) {
      console.warn(`[auth] 自动登录失败，回退到环境变量 token：${error.message}`)
      cached = { ...manual, source: 'env' }
      return cached
    }
    if (cache?.authorization && cache.expiresAt?.getTime() > Date.now()) {
      console.warn(`[auth] 自动登录失败，回退到缓存 token：${error.message}`)
      return cache
    }
    throw error
  }
}

/** 遇到 110002 时强制换 token；只调用一次，避免循环登录 */
export async function refreshAuthorization() {
  if (AUTH.mode !== 'auto') {
    const manual = manualInfo()
    if (isFresh(manual, 0)) {
      cached = { ...manual, source: 'env' }
      return cached
    }
    throw authError('token 已失效，且当前为手动模式')
  }
  return login()
}

export function authStatus() {
  return {
    mode: AUTH.mode,
    source: cached?.source || null,
    expiresAt: cached?.expiresAt?.toISOString() || null,
  }
}
