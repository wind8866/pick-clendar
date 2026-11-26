import { REQUEST_RETRIES, REQUEST_TIMEOUT_MS } from './config.mjs'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 请求 JSON 接口。网络错误 / 超时 / 5xx 会重试；4xx 和业务错误交给调用方判断。
 * 不打印请求头，避免 token 进日志。
 */
export async function requestJson(
  url,
  { method = 'GET', headers = {}, body, retries = REQUEST_RETRIES, timeoutMs = REQUEST_TIMEOUT_MS } = {},
) {
  let lastError
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
      const text = await res.text()
      let data = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          throw new Error(`响应不是 JSON（HTTP ${res.status}）`)
        }
      }
      if (res.status >= 500) {
        throw new Error(`HTTP ${res.status}`)
      }
      return { status: res.status, data, text }
    } catch (error) {
      lastError = error
      if (attempt < retries) await sleep(attempt * 1000)
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError
}
