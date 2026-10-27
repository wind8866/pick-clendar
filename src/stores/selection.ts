import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  EventOverride,
  FestivalConfig,
  FestivalEvent,
} from '@/types'
import { eventEnd, toDateKey, zoned } from '@/utils/time'

function normalizeMinutes(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(0, Math.floor(num))
}

function storageKeyFor(path: string): string {
  return `calendar-pick:v1:${path}`
}

export const useSelectionStore = defineStore('selection', () => {
  const config = ref<FestivalConfig | null>(null)
  const storageKey = ref('')
  const selectedIds = ref<string[]>([])
  const overrides = ref<Record<string, EventOverride>>({})
  const defaultTravelTime = ref(0)
  const highlightId = ref<string | null>(null)
  const hoverTitle = ref<string | null>(null)
  let highlightTimer: ReturnType<typeof setTimeout> | undefined
  let hoverTitleTimer: ReturnType<typeof setTimeout> | undefined
  let initialized = false

  const eventMap = computed(
    () => new Map((config.value?.events ?? []).map((event) => [event.id, event])),
  )
  const selectedSet = computed(() => new Set(selectedIds.value))
  const selectedCount = computed(() => selectedIds.value.length)
  const hasSelection = computed(() => selectedIds.value.length > 0)
  const schedulableEvents = computed<FestivalEvent[]>(
    () => (config.value?.events ?? []).filter((event) => event.kind !== 'header'),
  )
  const selectedEvents = computed<FestivalEvent[]>(() => {
    const events = [...selectedSet.value]
      .map((id) => eventMap.value.get(id))
      .filter((event): event is FestivalEvent => Boolean(event))
    return events.sort((a, b) => a.start.localeCompare(b.start))
  })

  const timeZone = computed(() => config.value?.timeZone ?? 'Asia/Shanghai')

  function init(nextConfig: FestivalConfig, path: string): void {
    config.value = nextConfig
    storageKey.value = storageKeyFor(path)
    selectedIds.value = []
    overrides.value = {}
    defaultTravelTime.value = 0
    highlightId.value = null
    hoverTitle.value = null

    const known = new Set(nextConfig.events.map((event) => event.id))
    try {
      const raw = localStorage.getItem(storageKey.value)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<{
          selectedIds: unknown
          defaultTravelTime: unknown
          overrides: unknown
        }>
        if (Array.isArray(parsed.selectedIds)) {
          const seen = new Set<string>()
          selectedIds.value = parsed.selectedIds.filter((id): id is string => {
            if (typeof id !== 'string' || !known.has(id) || seen.has(id)) return false
            seen.add(id)
            return true
          })
        }
        defaultTravelTime.value = normalizeMinutes(parsed.defaultTravelTime)
        if (parsed.overrides && typeof parsed.overrides === 'object') {
          const nextOverrides: Record<string, EventOverride> = {}
          for (const [id, value] of Object.entries(parsed.overrides)) {
            if (!known.has(id) || !value || typeof value !== 'object') continue
            const entry: EventOverride = {}
            const source = value as EventOverride
            if (typeof source.travelTime === 'number') {
              entry.travelTime = normalizeMinutes(source.travelTime)
            }
            if (typeof source.description === 'string' && source.description.trim()) {
              entry.description = source.description
            }
            if (Object.keys(entry).length) nextOverrides[id] = entry
          }
          overrides.value = nextOverrides
        }
      }
    } catch {
      // 本地数据损坏时回到默认状态，不阻塞页面
      selectedIds.value = []
      overrides.value = {}
      defaultTravelTime.value = 0
    }
    initialized = true
  }

  function save(): void {
    if (!initialized || !storageKey.value) return
    const payload = {
      version: 1 as const,
      selectedIds: selectedIds.value,
      defaultTravelTime: defaultTravelTime.value,
      overrides: overrides.value,
    }
    try {
      localStorage.setItem(storageKey.value, JSON.stringify(payload))
    } catch {
      // 存储空间不足或被禁用时忽略，页面仍可继续使用
    }
  }

  function flash(id: string): void {
    highlightId.value = id
    if (highlightTimer) clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => {
      if (highlightId.value === id) highlightId.value = null
    }, 1900)
  }

  function setHoverTitle(title: string): void {
    if (hoverTitleTimer) {
      clearTimeout(hoverTitleTimer)
      hoverTitleTimer = undefined
    }
    hoverTitle.value = title
  }

  function scheduleHideHoverTitle(): void {
    if (hoverTitleTimer) clearTimeout(hoverTitleTimer)
    hoverTitleTimer = setTimeout(() => {
      hoverTitle.value = null
      hoverTitleTimer = undefined
    }, 260)
  }

  function keepHoverTitle(): void {
    if (hoverTitleTimer) {
      clearTimeout(hoverTitleTimer)
      hoverTitleTimer = undefined
    }
  }

  function clearHoverTitle(): void {
    if (hoverTitleTimer) {
      clearTimeout(hoverTitleTimer)
      hoverTitleTimer = undefined
    }
    hoverTitle.value = null
  }

  function isHoverSibling(event: FestivalEvent): boolean {
    return hoverTitle.value !== null && hoverTitle.value === event.title
  }

  function displayTitle(event: FestivalEvent): string {
    return `${event.titlePrefix ?? ''}${event.title}`
  }

  function isSelected(id: string): boolean {
    return selectedSet.value.has(id)
  }

  function toggle(eventId: string): void {
    if (selectedSet.value.has(eventId)) discard(eventId)
    else pick(eventId)
  }

  function pick(eventId: string): void {
    if (!eventMap.value.has(eventId) || selectedSet.value.has(eventId)) return
    selectedIds.value = [...selectedIds.value, eventId]
    flash(eventId)
    save()
  }

  function discard(eventId: string): void {
    if (!selectedSet.value.has(eventId)) return
    selectedIds.value = selectedIds.value.filter((id) => id !== eventId)
    if (overrides.value[eventId]) {
      const next = { ...overrides.value }
      delete next[eventId]
      overrides.value = next
    }
    if (highlightId.value === eventId) highlightId.value = null
    save()
  }

  function setDefaultTravel(minutes: number): void {
    defaultTravelTime.value = normalizeMinutes(minutes)
    save()
  }

  function setTravel(eventId: string, minutes: number): void {
    const event = eventMap.value.get(eventId)
    if (!event) return
    const entry = { ...(overrides.value[eventId] ?? {}) }
    entry.travelTime = normalizeMinutes(minutes)
    overrides.value = { ...overrides.value, [eventId]: entry }
    save()
  }

  function setDescription(eventId: string, description: string): void {
    const event = eventMap.value.get(eventId)
    if (!event) return
    const next = description.trim()
    const entry = { ...(overrides.value[eventId] ?? {}) }
    if (!next || next === event.description) delete entry.description
    else entry.description = next
    if (Object.keys(entry).length) {
      overrides.value = { ...overrides.value, [eventId]: entry }
    } else {
      const copy = { ...overrides.value }
      delete copy[eventId]
      overrides.value = copy
    }
    save()
  }

  function travelOf(event: FestivalEvent): number {
    const override = overrides.value[event.id]?.travelTime
    return typeof override === 'number' ? override : defaultTravelTime.value
  }

  /** 判断 event 是否与已选中列表里上一场“紧挨”：同一天、两场间无其他排片、间隔在阈值内 */
  function isAdjacentToPrev(event: FestivalEvent): boolean {
    const index = selectedEvents.value.findIndex((item) => item.id === event.id)
    if (index <= 0) return false
    const prev = selectedEvents.value[index - 1]
    if (dateOf(prev) !== dateOf(event)) return false
    const gap = zoned(event.start, timeZone.value).diff(
      eventEnd(prev.start, prev.durationMinutes, timeZone.value),
      'minute',
    )
    if (gap < 0) return false
    // 活动场次（映后交流）间隔放宽到 2 小时，普通场次 1 小时
    const threshold = prev.postScreening || event.postScreening ? 120 : 60
    if (gap > threshold) return false
    const dayKey = dateOf(event)
    const dayEvents = schedulableEvents.value
      .filter((item) => dateOf(item) === dayKey)
      .sort((a, b) => a.start.localeCompare(b.start))
    const prevIndex = dayEvents.findIndex((item) => item.id === prev.id)
    const eventIndex = dayEvents.findIndex((item) => item.id === event.id)
    return prevIndex >= 0 && eventIndex >= 0 && eventIndex - prevIndex === 1
  }

  /** 紧挨场次不显示路程（导出同样处理），返回 0 */
  function effectiveTravelOf(event: FestivalEvent): number {
    return isAdjacentToPrev(event) ? 0 : travelOf(event)
  }

  function composedMeta(event: FestivalEvent): string {
    const parts: string[] = []
    if (event.director) parts.push(`导演：${event.director}`)
    if (event.rating !== undefined) {
      const count = event.ratingCount !== undefined ? `（${event.ratingCount} 人评价）` : ''
      parts.push(`${event.rating}${count}`)
    }
    if (event.year !== undefined) parts.push(String(event.year))
    if (event.language) parts.push(event.language)
    return parts.join(' · ')
  }

  function descriptionOf(event: FestivalEvent): string {
    const override = overrides.value[event.id]?.description
    if (override) return override
    if (event.description) return event.description
    return composedMeta(event)
  }

  function endOf(event: FestivalEvent): string {
    return eventEnd(event.start, event.durationMinutes, timeZone.value).toISOString()
  }

  function dateOf(event: FestivalEvent): string {
    return toDateKey(event.start, timeZone.value)
  }

  function startDate(event: FestivalEvent) {
    return zoned(event.start, timeZone.value)
  }

  function clearAll(): void {
    selectedIds.value = []
    overrides.value = {}
    defaultTravelTime.value = 0
    highlightId.value = null
    hoverTitle.value = null
    if (highlightTimer) clearTimeout(highlightTimer)
    if (hoverTitleTimer) clearTimeout(hoverTitleTimer)
    try {
      if (storageKey.value) localStorage.removeItem(storageKey.value)
    } catch {
      // ignore
    }
  }

  return {
    config,
    storageKey,
    selectedIds,
    overrides,
    defaultTravelTime,
    highlightId,
    hoverTitle,
    timeZone,
    selectedCount,
    hasSelection,
    selectedEvents,
    schedulableEvents,
    init,
    isSelected,
    toggle,
    pick,
    discard,
    setDefaultTravel,
    setTravel,
    setDescription,
    travelOf,
    effectiveTravelOf,
    isAdjacentToPrev,
    descriptionOf,
    endOf,
    dateOf,
    startDate,
    clearAll,
    setHoverTitle,
    scheduleHideHoverTitle,
    keepHoverTitle,
    clearHoverTitle,
    isHoverSibling,
    displayTitle,
    composedMeta,
  }
})
