import type { FestivalConfig } from '@/types'

/** 影厅颜色：由 config.hallColors 配置；未配置的厅返回 undefined，由调用方回退到主题主色 */
export function hallColor(config: FestivalConfig, location?: string): string | undefined {
  if (!location) return undefined
  const configured = config.hallColors?.[location]
  return configured?.trim() || undefined
}
