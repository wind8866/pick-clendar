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
  /** 影厅 / 场地（同一影院多厅排片时用于筛选与展示） */
  location?: string
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

export interface FestivalLabels {
  /** 特色场次标签（如「映后交流」）；设为空字符串则不显示 */
  featured?: string
  /** 详情中同名场次分组的标题（如「同片场次」） */
  sameTitle?: string
}

/** 判定「两场紧挨」的间隔阈值（分钟） */
export interface FestivalAdjacency {
  /** 普通场次 */
  normalMinutes?: number
  /** 特色场次（如带映后交流） */
  featuredMinutes?: number
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
  /** 月视图首行所在日期；缺省时取最早一场的日期 */
  initialDate: string
  /** 订阅地址覆盖项；缺省时由站点 origin + BASE_URL 自动生成 */
  subscribeUrl?: string
  /** 构建期生成二维码用的站点绝对地址（仅脚本读取） */
  siteOrigin?: string
  shareUrl?: string
  itemNoun: string
  updatedAt?: string
  /** 默认视图；缺省时桌面用月视图、移动端用周视图 */
  defaultView?: CalendarView
  theme?: FestivalTheme
  labels?: FestivalLabels
  adjacency?: FestivalAdjacency
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
