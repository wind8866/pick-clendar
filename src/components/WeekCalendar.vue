<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Dayjs } from 'dayjs'
import type { FestivalConfig, FestivalEvent } from '@/types'
import { useSelectionStore } from '@/stores/selection'
import { useEventHover } from '@/composables/useEventHover'
import { useIsMobile } from '@/composables/useIsMobile'
import {
  dayjs,
  hm,
  startOfWeek,
  toDateKey,
  weekdayLabel,
  zoned,
} from '@/utils/time'
import EventHoverCard from '@/components/EventHoverCard.vue'
import EventMobileDialog from '@/components/EventMobileDialog.vue'

const props = defineProps<{
  config: FestivalConfig
  anchor: string
  /** 由「今天 / 上一周 / 下一周」触发的跳转序号，避免与自由滚动的锚点回传互相干扰 */
  jumpSeq?: number
}>()

const emit = defineEmits<{
  'update:anchor': [value: string]
  'range-change': [range: { start: string; end: string }]
}>()

const store = useSelectionStore()
const isMobile = useIsMobile()
const dialogEvent = ref<FestivalEvent | null>(null)
const scrollEl = ref<HTMLElement | null>(null)

// 横向日历渲染足够长的连续日期，用户可自由左右滑动并停在任意位置
const WEEKS_BEFORE = 12
const WEEKS_AFTER = 12
const VISIBLE_DAYS = 7
const DAY_COUNT = (WEEKS_BEFORE + 1 + WEEKS_AFTER) * 7

const axisWidth = computed(() => (isMobile.value ? 42 : 58))
const dayWidth = ref(50)

function weekStartOf(value: string): Dayjs {
  return startOfWeek(zoned(`${value}T12:00:00+08:00`, props.config.timeZone))
}

function initialRangeStart(anchor: string): Dayjs {
  return weekStartOf(anchor).subtract(WEEKS_BEFORE, 'week')
}

const rangeStart = ref<Dayjs>(initialRangeStart(props.anchor))
const days = computed<Dayjs[]>(() =>
  Array.from({ length: DAY_COUNT }, (_, index) => rangeStart.value.add(index, 'day')),
)

let ready = false
let ticking = false
let lastAnchorKey = ''
let lastRangeKey = ''
let lastScrollLeftX = 0
let hintTimer: ReturnType<typeof setTimeout> | undefined
let resizeObserver: ResizeObserver | undefined
const showSwipeHint = ref(true)

// 从移动端切回桌面布局时收起弹窗，避免残留遮罩
watch(isMobile, (mobile) => {
  if (mobile) {
    showSwipeHint.value = true
    if (hintTimer) clearTimeout(hintTimer)
    hintTimer = setTimeout(() => {
      showSwipeHint.value = false
    }, 7000)
  } else {
    showSwipeHint.value = false
    if (hintTimer) {
      clearTimeout(hintTimer)
      hintTimer = undefined
    }
    dialogEvent.value = null
  }
})

const {
  event: hoverEvent,
  x: hoverX,
  y: hoverY,
  show: showHover,
  scheduleHide,
  enterCard,
  leaveCard,
  hide: hideHover,
} = useEventHover()

// 时间轴范围：由全部日程的最早开始 / 最晚结束动态决定，向下取整 −1h、向上取整 +1h
const rangeBounds = computed(() => {
  let minStart = Infinity
  let maxEnd = -Infinity
  for (const event of props.config.events) {
    if (event.kind === 'header') continue
    const start = zoned(event.start, props.config.timeZone)
    const startMin = start.hour() * 60 + start.minute()
    const endMin = startMin + event.durationMinutes
    if (startMin < minStart) minStart = startMin
    if (endMin > maxEnd) maxEnd = endMin
  }
  if (!Number.isFinite(minStart) || !Number.isFinite(maxEnd)) {
    return { startMin: 9 * 60, endMin: 21 * 60 }
  }
  const start = Math.max(0, Math.floor(minStart / 60) * 60 - 60)
  const end = Math.min(24 * 60, Math.ceil(maxEnd / 60) * 60 + 60)
  return { startMin: start, endMin: end }
})

const dayStartMin = computed(() => rangeBounds.value.startMin)
const dayEndMin = computed(() => rangeBounds.value.endMin)
const totalMinutes = computed(() => Math.max(1, dayEndMin.value - dayStartMin.value))
const startHour = computed(() => Math.floor(dayStartMin.value / 60))
const endHour = computed(() => Math.ceil(dayEndMin.value / 60))
const hours = computed(() =>
  Array.from({ length: endHour.value - startHour.value + 1 }, (_, index) => startHour.value + index),
)

const eventsByDate = computed(() => {
  const map = new Map<string, FestivalEvent[]>()
  for (const event of props.config.events) {
    if (event.kind === 'header') continue
    const key = toDateKey(event.start, props.config.timeZone)
    const bucket = map.get(key)
    if (bucket) bucket.push(event)
    else map.set(key, [event])
  }
  for (const bucket of map.values()) bucket.sort((a, b) => a.start.localeCompare(b.start))
  return map
})

function eventsFor(day: Dayjs): FestivalEvent[] {
  return eventsByDate.value.get(day.format('YYYY-MM-DD')) ?? []
}

function startText(event: FestivalEvent): string {
  return hm(zoned(event.start, props.config.timeZone))
}

function endText(event: FestivalEvent): string {
  return hm(zoned(event.start, props.config.timeZone).add(event.durationMinutes, 'minute'))
}

function directorYear(event: FestivalEvent): string {
  const parts: string[] = []
  if (event.director) parts.push(event.director)
  if (event.year !== undefined) parts.push(String(event.year))
  return parts.join(' · ')
}

function positionStyle(event: FestivalEvent): Record<string, string> {
  const start = zoned(event.start, props.config.timeZone)
  const startMin = start.hour() * 60 + start.minute()
  const endMin = startMin + event.durationMinutes
  const visibleStart = Math.max(startMin, dayStartMin.value)
  const visibleEnd = Math.min(endMin, dayEndMin.value)
  if (visibleEnd <= visibleStart) return { display: 'none' }
  const top = ((visibleStart - dayStartMin.value) / totalMinutes.value) * 100
  const height = ((visibleEnd - visibleStart) / totalMinutes.value) * 100
  return {
    top: `${top}%`,
    height: `${Math.max(height, 2.5)}%`,
  }
}

function computeDayWidth(el: HTMLElement): number {
  return Math.max(24, (el.clientWidth - axisWidth.value) / VISIBLE_DAYS)
}

function anchorIndexFor(value: string): number {
  const key = weekStartOf(value).format('YYYY-MM-DD')
  const index = days.value.findIndex((day) => day.format('YYYY-MM-DD') === key)
  return index < 0 ? 0 : index
}

function visibleIndices(): { left: number; right: number; firstFull: number } | null {
  const el = scrollEl.value
  if (!el || !dayWidth.value) return null
  const last = days.value.length - 1
  const visibleWidth = Math.max(0, el.clientWidth - axisWidth.value)
  const left = Math.min(last, Math.max(0, Math.floor((el.scrollLeft + 1) / dayWidth.value)))
  const right = Math.min(
    last,
    Math.max(left, Math.floor((el.scrollLeft + visibleWidth - 1) / dayWidth.value)),
  )
  // 第一列完全露出屏幕的日期；用它来切换月视图，避免半格日期把锚点拉到上一周
  const firstFull = Math.min(
    right,
    Math.max(left, Math.ceil((el.scrollLeft - 1) / dayWidth.value)),
  )
  return { left, right, firstFull }
}

function updateVisible(): void {
  if (!ready) return
  const indices = visibleIndices()
  if (!indices) return
  const leftDay = days.value[indices.left]
  const rightDay = days.value[indices.right]
  const anchorDay = days.value[indices.firstFull]
  if (!leftDay || !rightDay || !anchorDay) return

  const rangeKey = `${indices.left}-${indices.right}`
  if (rangeKey !== lastRangeKey) {
    lastRangeKey = rangeKey
    emit('range-change', {
      start: leftDay.format('YYYY-MM-DD'),
      end: rightDay.format('YYYY-MM-DD'),
    })
  }

  // 锚点取第一列完整可见日期所在周的周一，与周切换的语义保持一致
  const anchorKey = startOfWeek(anchorDay).format('YYYY-MM-DD')
  if (anchorKey !== lastAnchorKey) {
    lastAnchorKey = anchorKey
    emit('update:anchor', anchorKey)
  }
}

function scrollToIndex(index: number): void {
  const el = scrollEl.value
  if (!el) return
  el.scrollLeft = Math.max(0, index) * dayWidth.value
}

function onScroll(): void {
  hideHover()
  store.clearHoverTitle()
  const el = scrollEl.value
  if (!el) return
  if (ready && Math.abs(el.scrollLeft - lastScrollLeftX) > 2) {
    showSwipeHint.value = false
  }
  lastScrollLeftX = el.scrollLeft
  if (!ready || ticking) return
  ticking = true
  requestAnimationFrame(() => {
    ticking = false
    updateVisible()
  })
}

function onResize(): void {
  const el = scrollEl.value
  if (!el) return
  const oldWidth = dayWidth.value
  const leftIndex = oldWidth ? Math.round(el.scrollLeft / oldWidth) : 0
  const nextWidth = computeDayWidth(el)
  if (Math.abs(nextWidth - oldWidth) < 0.5) {
    updateVisible()
    return
  }
  dayWidth.value = nextWidth
  nextTick(() => {
    if (!scrollEl.value) return
    scrollEl.value.scrollLeft = leftIndex * nextWidth
    lastScrollLeftX = scrollEl.value.scrollLeft
    updateVisible()
  })
}

function rebuildRange(target: Dayjs): void {
  rangeStart.value = target.subtract(WEEKS_BEFORE, 'week')
  lastAnchorKey = ''
  lastRangeKey = ''
  nextTick(() => {
    scrollToIndex(anchorIndexFor(target.format('YYYY-MM-DD')))
    updateVisible()
  })
}

function scrollToAnchor(value: string): void {
  const target = weekStartOf(value)
  const targetKey = target.format('YYYY-MM-DD')
  const index = days.value.findIndex((day) => day.format('YYYY-MM-DD') === targetKey)
  if (index < 0) {
    rebuildRange(target)
    return
  }
  scrollToIndex(index)
}

watch(
  () => props.jumpSeq,
  () => {
    if (!ready) return
    scrollToAnchor(props.anchor)
  },
)

function onEnter(mouse: MouseEvent, event: FestivalEvent): void {
  if (isMobile.value) return
  showHover(event, mouse.clientX, mouse.clientY)
  store.setHoverTitle(event.title)
}

function onLeave(): void {
  if (isMobile.value) return
  scheduleHide()
  store.scheduleHideHoverTitle()
}

function onHoverPick(): void {
  if (hoverEvent.value) store.toggle(hoverEvent.value.id)
}

function onClick(event: FestivalEvent): void {
  hideHover()
  store.clearHoverTitle()
  if (isMobile.value) {
    // 移动端点击只打开详情弹窗，不直接选中
    dialogEvent.value = event
    return
  }
  store.toggle(event.id)
}

function onDialogPick(): void {
  if (!dialogEvent.value) return
  store.toggle(dialogEvent.value.id)
  // 移动端弹窗中加入 / 移出后自动关闭
  dialogEvent.value = null
}

const now = ref(dayjs())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    now.value = dayjs()
  }, 30_000)

  const el = scrollEl.value
  if (!el) return
  dayWidth.value = computeDayWidth(el)
  nextTick(() => {
    if (!scrollEl.value) return
    scrollToIndex(anchorIndexFor(props.anchor))
    lastScrollLeftX = scrollEl.value.scrollLeft
    ready = true
    updateVisible()
    if (isMobile.value) {
      showSwipeHint.value = true
      hintTimer = setTimeout(() => {
        showSwipeHint.value = false
      }, 7000)
    }
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(onResize)
      resizeObserver.observe(scrollEl.value)
    }
  })
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (hintTimer) clearTimeout(hintTimer)
  resizeObserver?.disconnect()
})

const todayKey = computed(() => now.value.tz(props.config.timeZone).format('YYYY-MM-DD'))
const nowPercent = computed(() => {
  const current = now.value.tz(props.config.timeZone)
  const minutes = current.hour() * 60 + current.minute()
  if (minutes < dayStartMin.value || minutes > dayEndMin.value) return null
  return ((minutes - dayStartMin.value) / totalMinutes.value) * 100
})

function isToday(day: Dayjs): boolean {
  return day.format('YYYY-MM-DD') === todayKey.value
}

function isWeekend(day: Dayjs): boolean {
  const weekday = day.day()
  return weekday === 0 || weekday === 6
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

function hourTop(hour: number): string {
  const minutes = hour * 60 - dayStartMin.value
  return `${(minutes / totalMinutes.value) * 100}%`
}
</script>

<template>
  <div class="week-shell">
    <div ref="scrollEl" class="week-scroll" @scroll="onScroll">
      <div
        class="week-inner"
        :style="{
          '--day-w': `${dayWidth}px`,
          '--axis-w': `${axisWidth}px`,
          '--day-count': String(days.length),
        }"
      >
        <div class="week-top">
          <div class="axis-corner">时间</div>
          <div class="day-heads">
            <div
              v-for="day in days"
              :key="day.format('YYYY-MM-DD')"
              class="day-head"
              :class="{ today: isToday(day), weekend: isWeekend(day) }"
            >
              <span class="weekday">{{ weekdayLabel(day) }}</span>
              <span class="date">{{ day.format('MM/DD') }}</span>
            </div>
          </div>
        </div>

        <div class="week-body">
          <div class="week-canvas">
            <div class="axis">
              <span
                v-for="(hour, index) in hours"
                :key="hour"
                class="hour-label"
                :class="{ first: index === 0, last: index === hours.length - 1 }"
                :style="{ top: hourTop(hour) }"
              >
                {{ hourLabel(hour) }}
              </span>
            </div>

            <div class="columns">
              <div
                v-for="day in days"
                :key="day.format('YYYY-MM-DD')"
                class="day-col"
                :class="{ today: isToday(day), weekend: isWeekend(day) }"
              >
                <div
                  v-for="hour in hours"
                  :key="`${day.format('YYYY-MM-DD')}-${hour}`"
                  class="hour-line"
                  :style="{ top: hourTop(hour) }"
                />

                <div
                  v-if="isToday(day) && nowPercent !== null"
                  class="now-line"
                  :style="{ top: `${nowPercent}%` }"
                >
                  <span class="now-dot" />
                </div>

                <button
                  v-for="event in eventsFor(day)"
                  :key="event.id"
                  type="button"
                  class="event-block"
                  :class="{
                    selected: store.isSelected(event.id),
                    'hover-same': store.isCalendarHighlighted(event),
                  }"
                  :style="positionStyle(event)"
                  @click.stop="onClick(event)"
                  @mouseenter="onEnter($event, event)"
                  @mouseleave="onLeave"
                >
                  <span class="event-time">
                    {{ startText(event) }}<span class="event-time-end"> – {{ endText(event) }}</span>
                  </span>
                  <span class="event-title">{{ store.displayTitle(event) }}</span>
                  <span v-if="directorYear(event)" class="event-sub">{{ directorYear(event) }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isMobile && showSwipeHint" class="swipe-hint" aria-hidden="true">
      ← 左右滑动查看 →
    </div>

    <EventHoverCard
      v-if="hoverEvent && !isMobile"
      :event="hoverEvent"
      :config="config"
      :selected="store.isSelected(hoverEvent.id)"
      :x="hoverX"
      :y="hoverY"
      @enter="enterCard"
      @leave="leaveCard"
      @pick="onHoverPick"
    />

    <EventMobileDialog
      v-if="dialogEvent"
      :event="dialogEvent"
      :config="config"
      :selected="store.isSelected(dialogEvent.id)"
      @pick="onDialogPick"
      @close="dialogEvent = null"
    />
  </div>
</template>

<style scoped>
.week-shell {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.week-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior-x: contain;
}

/* 桌面端保持按周翻页，不启用移动端的自由横向滑动 */
@media (min-width: 901px) {
  .week-scroll {
    overflow-x: hidden;
  }
}

.week-inner {
  display: flex;
  width: calc(var(--axis-w) + var(--day-w) * var(--day-count));
  height: 100%;
  flex-direction: column;
}

.week-top {
  position: sticky;
  top: 0;
  z-index: 6;
  display: flex;
  flex: none;
  border-bottom: 1px solid var(--line);
  background: var(--panel-soft);
}

.axis-corner {
  position: sticky;
  left: 0;
  z-index: 7;
  display: flex;
  width: var(--axis-w);
  flex: none;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--line-soft);
  background: var(--panel-soft);
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.12em;
}

.day-heads {
  display: flex;
  width: calc(var(--day-w) * var(--day-count));
  flex: none;
}

.day-head {
  display: flex;
  width: var(--day-w);
  flex: none;
  gap: 5px;
  align-items: baseline;
  justify-content: center;
  padding: 9px 4px;
  border-right: 1px solid var(--line-soft);
}

.day-head.weekend {
  background: rgb(106 52 36 / 4%);
}

.day-head:last-child {
  border-right: 0;
}

.weekday {
  color: var(--ink-soft);
  font-size: 12px;
}

.date {
  color: var(--muted);
  font-family: var(--font-serif);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.day-head.today .weekday,
.day-head.today .date {
  color: var(--red);
  font-weight: 700;
}

.week-body {
  flex: 1;
  min-height: 0;
  background: var(--paper-strong);
}

.week-canvas {
  display: flex;
  height: 100%;
  min-height: 620px;
}

.axis {
  position: sticky;
  left: 0;
  z-index: 3;
  width: var(--axis-w);
  flex: none;
  border-right: 1px solid var(--line-soft);
  background: var(--paper-strong);
}

.hour-label {
  position: absolute;
  right: 8px;
  color: var(--muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  transform: translateY(-50%);
}

.hour-label.first {
  transform: translateY(0);
}

.hour-label.last {
  transform: translateY(-100%);
}

.columns {
  display: flex;
  width: calc(var(--day-w) * var(--day-count));
  flex: none;
}

.day-col {
  position: relative;
  width: var(--day-w);
  min-width: 0;
  flex: none;
  border-right: 1px solid var(--line-soft);
}

.day-col.weekend {
  background: rgb(106 52 36 / 3%);
}

.day-col:last-child {
  border-right: 0;
}

.day-col.today {
  background: rgb(106 52 36 / 3%);
}

.hour-line {
  position: absolute;
  right: 0;
  left: 0;
  border-top: 1px solid var(--line-soft);
  pointer-events: none;
}

.event-block {
  position: absolute;
  right: 5px;
  left: 5px;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  gap: 1px;
  min-height: 40px;
  padding: 4px 6px;
  border: 0;
  border-left: 3px solid var(--red);
  border-radius: 4px;
  background: var(--week-default-bg);
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  transition: background 0.13s ease;
}

.event-block:hover {
  background: rgb(106 52 36 / 7%);
}

.event-block.selected {
  background: var(--sel-bg);
  border-left-color: var(--sel-line);
}

.event-block.hover-same {
  background: var(--hover-same-bg);
  border-left-color: var(--hover-same-fg);
}

.event-block.hover-same .event-time,
.event-block.hover-same .event-title,
.event-block.hover-same .event-sub {
  color: var(--hover-same-fg);
}

.event-time {
  color: var(--muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}

.event-title {
  overflow: hidden;
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-sub {
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 10px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.now-line {
  position: absolute;
  right: 0;
  left: 0;
  z-index: 4;
  height: 0;
  border-top: 1.5px solid var(--red);
  pointer-events: none;
}

.now-dot {
  position: absolute;
  top: -3.5px;
  left: -3px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--red);
}

.swipe-hint {
  position: absolute;
  top: 54px;
  left: 50%;
  z-index: 8;
  padding: 4px 11px;
  border: 1px solid var(--line-soft);
  border-radius: 99px;
  background: rgb(248 241 231 / 0.92);
  box-shadow: 0 3px 12px rgb(61 38 25 / 12%);
  color: var(--ink-soft);
  font-size: 11px;
  pointer-events: none;
  transform: translateX(-50%);
  animation: swipe-hint-in 0.25s ease;
}

@keyframes swipe-hint-in {
  from {
    opacity: 0;
    transform: translate(-50%, -4px);
  }
}

@media (max-width: 900px) {
  .week-canvas {
    min-height: 520px;
  }

  .axis-corner {
    font-size: 9px;
    letter-spacing: 0;
  }

  .hour-label {
    right: 5px;
    font-size: 9px;
  }

  .day-head {
    flex-direction: column;
    gap: 0;
    align-items: center;
    justify-content: center;
    padding: 6px 2px 7px;
    line-height: 1.25;
  }

  .weekday {
    font-size: 11px;
  }

  .date {
    font-size: 13px;
  }

  .event-block {
    right: 2px;
    left: 2px;
    gap: 1px;
    min-height: 28px;
    padding: 3px 4px;
    border-left-width: 0;
  }

  .event-time {
    font-size: 10px;
  }

  .event-time-end {
    display: none;
  }

  .event-title {
    font-size: 12px;
    line-height: 1.3;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .event-sub {
    display: none;
  }
}
</style>
