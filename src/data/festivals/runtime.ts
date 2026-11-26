import type { FestivalConfig } from '@/types'
import { findFestival } from './index'
import { staticPath } from '@/utils/site'

const TIMEOUT_MS = 2500

async function fetchJson<T>(path: string): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(staticPath(path), {
      cache: 'no-cache',
      signal: controller.signal,
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    // 没有启动同步服务、断网或超时：静默回退到打包数据
    return null
  } finally {
    clearTimeout(timer)
  }
}

function applyRuntime(config: FestivalConfig, runtime: Partial<FestivalConfig> | null): void {
  if (!runtime || runtime.id !== config.id) return
  if (!Array.isArray(runtime.events) || runtime.events.length === 0) return
  Object.assign(config, runtime)
}

/**
 * 路由守卫在页面 setup 之前调用：先换成本地运行时配置，失败就保留打包数据。
 * 这里直接改已加载的配置对象，避免把 PickPage / FestivalListPage 全部改成 async。
 */
export async function hydrateFestival(id: string): Promise<void> {
  const config = findFestival(id)
  if (!config) return
  const runtime = await fetchJson<FestivalConfig>(`runtime/festivals/${id}.json`)
  applyRuntime(config, runtime)
}

/** 列表页只需要名称、主题、updatedAt 等元数据，不拉整份 events */
export async function hydrateIndex(): Promise<void> {
  const list = await fetchJson<Array<Partial<FestivalConfig>>>('runtime/festivals/index.json')
  if (!Array.isArray(list)) return
  for (const meta of list) {
    if (!meta?.id) continue
    const config = findFestival(meta.id)
    if (config) Object.assign(config, meta, { runtime: true })
  }
}
