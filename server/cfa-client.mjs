import { APP_HEADERS, CALENDAR_URL } from './config.mjs'
import { requestJson } from './http.mjs'

export class CfaApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'CfaApiError'
    this.status = status
  }
}

export class CfaAuthError extends CfaApiError {
  constructor(message = '登录已失效', status = 110002) {
    super(message, status)
    this.name = 'CfaAuthError'
  }
}

export async function fetchMonth(authorization, year, month) {
  const { data, status } = await requestJson(CALENDAR_URL, {
    method: 'POST',
    headers: { ...APP_HEADERS, 'Authori-zation': authorization },
    body: {
      year: String(year),
      month: String(month),
      cinema_code: '',
    },
  })

  if (data?.status === 110002) {
    throw new CfaAuthError(data?.msg || '请登录')
  }
  if (data?.status !== 200) {
    throw new CfaApiError(`排片接口返回 ${data?.status ?? status}：${data?.msg || '未知错误'}`, data?.status)
  }

  const days = Array.isArray(data.data?.list) ? data.data.list : []
  const screens = []
  for (const day of days) {
    if (Array.isArray(day?.screen)) screens.push(...day.screen)
  }
  return screens
}

/** 逐月抓取；任何一个月失败都抛错，由上层决定不写半份数据 */
export async function fetchMonths(authorization, months) {
  const all = []
  for (const item of months) {
    const screens = await fetchMonth(authorization, item.year, item.month)
    console.log(`[fetch] ${item.label}：${screens.length} 场`)
    all.push(...screens)
  }
  return all
}
