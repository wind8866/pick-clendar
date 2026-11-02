import type { FestivalConfig } from '@/types'

function trimOrigin(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * 站点绝对地址。默认取当前页面 origin，因此换域名、多套环境都无需改代码；
 * 需要固定域名时可在构建期设置 VITE_SITE_ORIGIN。
 */
export function siteOrigin(): string {
  const configured = import.meta.env.VITE_SITE_ORIGIN
  if (typeof configured === 'string' && configured.trim()) {
    return trimOrigin(configured.trim())
  }
  if (typeof window !== 'undefined') return trimOrigin(window.location.origin)
  return ''
}

/** 带 BASE_URL 的静态资源路径，兼容部署在子路径的情况 */
export function staticPath(path: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  return `${base}/${path.replace(/^\/+/, '')}`
}

/**
 * 订阅地址必须是可以直接粘进日历 App 的绝对地址。
 * config.subscribeUrl 仅作为覆盖项（例如指向正式 CDN），不再依赖配置里写死域名。
 */
export function subscribeUrl(config: FestivalConfig): string {
  const override = config.subscribeUrl?.trim()
  if (override) return override
  const path = staticPath(`subscribe/${config.id}.ics`)
  const origin = siteOrigin()
  return origin ? new URL(path, origin).toString() : path
}

export function qrCodePath(config: FestivalConfig): string {
  return staticPath(`qrcode/${config.id}.svg`)
}
