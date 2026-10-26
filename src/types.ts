export interface FestivalEvent {
  id: string
  title: string
  /** ISO 8601，带时区偏移，例如 2026-10-29T19:30:00+08:00 */
  start: string
  durationMinutes: number
  description: string
  url: string
  postScreening?: boolean
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
  dayStart: string
  dayEnd: string
  subscribeUrl: string
  itemNoun: string
  updatedAt?: string
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

export interface CalendarMode {
  mode: 'browse' | 'select'
}

export type CalendarView = 'month' | 'week'
