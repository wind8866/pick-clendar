export interface FestivalTheme {
  /** 背景色 */
  background: string
  /** 可交互主色调 */
  primary: string
  /** 协助交互 / 联动高亮色 */
  secondary: string
}

export interface FestivalEvent {
  id: string
  /** 去前缀的标题，用于同标题联动匹配 */
  title: string
  /** 标题前缀图标（如 🎉），与 title 分离存储 */
  titlePrefix?: string
  /** ISO 8601，带时区偏移，例如 2026-10-29T19:30:00+08:00 */
  start: string
  durationMinutes: number
  /** 自由补充描述，可为空 */
  description: string
  /** 周视图专属补充说明，可选 */
  weekDesc?: string
  director?: string
  year?: number
  language?: string
  rating?: number
  ratingCount?: number
  url: string
  postScreening?: boolean
  /** 特殊日程类型：header 为标题头（仅进导出数据，前端不展示） */
  kind?: 'header'
}

export interface FestivalConfig {
  schemaVersion: number
  isDefault?: boolean
  id: string
  name: string
  city?: string
  venue?: string
  venueAddress?: string
  timeZone: string
  initialDate: string
  subscribeUrl: string
  shareUrl?: string
  itemNoun: string
  updatedAt?: string
  theme?: FestivalTheme
  events: FestivalEvent[]
}

export interface EventOverride {
  travelTime?: number
  description?: string
}

export interface PersistedState {
  version: 1
  selectedIds: string[]
  defaultTravelTime: number
  overrides: Record<string, EventOverride>
}

export interface EventView {
  event: FestivalEvent
  end: string
  travelTime: number
  description: string
}

export interface ExportItem {
  event: FestivalEvent
  /** 结束时间，ISO 字符串 */
  end: string
  description: string
  travelTime: number
}

export type CalendarView = 'month' | 'week'
