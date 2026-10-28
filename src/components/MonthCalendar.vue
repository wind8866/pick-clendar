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
  WEEKDAYS_MON,
  zoned,
} from '@/utils/time'
import EventHoverCard from '@/components/EventHoverCard.vue'

const props = defineProps<{
  config: FestivalConfig
  anchor: string
}>()

const emit = defineEmits<{
  'open-day': [date: string]
  'update:anchor': [weekStart: string]
}>()

const store = useSelectionStore()
const isMobile = useIsMobile()
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

const scrollEl = ref<HTMLElement | null>(null)
const rowHeight = ref(120)
const weeks = ref<WeekRow[]>([])
const topWeekKey = ref('')
const rangeStart = ref<Dayjs | null>(null)
let ready = false
let extending = false
let ticking = false
let resizeObserver: ResizeObserver | undefined

interface WeekRow {
  key: string
  start: Dayjs
  days: Dayjs[]
}

const BEFORE_WEEKS = 26
const AFTER_WEEKS = 52
const EXTEND_WEEKS = 26

// 格子内预留：日期头 + 内边距
const CELL_OVERHEAD = 30
// 单个日程块占用高度（含间距）；移动端允许标题折成两行，预留更多高度
const chipHeight = computed(() => (isMobile.value ? 32 : 24))

function makeWeek(start: Dayjs): WeekRow {
  return {
    key: start.format('YYYY-MM-DD'),
    start,
    days: Array.from({ length: 7 }, (_, index) => start.add(index, 'day')),
  }
}

function anchorWeek(): Dayjs {
  return startOfWeek(zoned(`${props.anchor}T12:00:00+08:00`, props.config.timeZone))
}

function buildRange(start: Dayjs, count: number): WeekRow[] {
  return Array.from({ length: count }, (_, index) => makeWeek(start.add(index, 'week')))
}

function resetRange(anchor: Dayjs): void {
  const start = anchor.subtract(BEFORE_WEEKS, 'week')
  weeks.value = buildRange(start, BEFORE_WEEKS + 1 + AFTER_WEEKS)
  rangeStart.value = start
}

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

// 激进显示：尽可能铺满格子，仅在溢出时预留一行显示 +N
const maxChips = computed(() =>
  Math.max(1, Math.floor((rowHeight.value - CELL_OVERHEAD) / chipHeight.value)),
)

function visibleEvents(day: Dayjs): FestivalEvent[] {
  const events = eventsFor(day)
  const fit = maxChips.value
  if (events.length <= fit) return events
  return events.slice(0, Math.max(1, fit - 1))
}

function extraCount(day: Dayjs): number {
  return Math.max(0, eventsFor(day).length - visibleEvents(day).length)
}

function onChipClick(mouse: MouseEvent, event: FestivalEvent): void {
  mouse.stopPropagation()
  store.toggle(event.id)
  hideHover()
  store.clearHoverTitle()
}

function onChipEnter(mouse: MouseEvent, event: FestivalEvent): void {
  if (isMobile.value) return
  showHover(event, mouse.clientX, mouse.clientY)
  store.setHoverTitle(event.title)
}

function onChipLeave(): void {
  if (isMobile.value) return
  scheduleHide()
  store.scheduleHideHoverTitle()
}

function onHoverPick(): void {
  if (hoverEvent.value) store.toggle(hoverEvent.value.id)
}

function onCellClick(day: Dayjs): void {
  if (!eventsFor(day).length) return
  emit('open-day', day.format('YYYY-MM-DD'))
}

function isToday(day: Dayjs): boolean {
  return day.format('YYYY-MM-DD') === dayjs().tz(props.config.timeZone).format('YYYY-MM-DD')
}

function applyRowHeight(next: number): void {
  if (!Number.isFinite(next) || next <= 0) return
  const el = scrollEl.value
  const old = rowHeight.value
  const topIndex = el && old ? Math.round(el.scrollTop / old) : BEFORE_WEEKS
  rowHeight.value = next
  if (!el) return
  nextTick(() => {
    el.scrollTop = Math.max(0, topIndex) * next
  })
}

function measure(): void {
  const el = scrollEl.value
  if (!el) return
  applyRowHeight(el.clientHeight / 5)
}

function prependWeeks(): void {
  if (extending || !rangeStart.value) return
  extending = true
  const start = rangeStart.value.subtract(EXTEND_WEEKS, 'week')
  const added = buildRange(start, EXTEND_WEEKS)
  rangeStart.value = start
  weeks.value = [...added, ...weeks.value]
  nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop += EXTEND_WEEKS * rowHeight.value
    extending = false
  })
}

function appendWeeks(): void {
  if (extending) return
  const last = weeks.value[weeks.value.length - 1]
  if (!last) return
  extending = true
  const start = last.start.add(1, 'week')
  weeks.value = [...weeks.value, ...buildRange(start, EXTEND_WEEKS)]
  nextTick(() => {
    extending = false
  })
}

function updateTopWeek(): void {
  const el = scrollEl.value
  if (!el || !rowHeight.value) return
  const index = Math.max(
    0,
    Math.min(weeks.value.length - 1, Math.floor((el.scrollTop + rowHeight.value * 0.35) / rowHeight.value)),
  )
  const key = weeks.value[index]?.key
  if (!key || key === topWeekKey.value) return
  topWeekKey.value = key
  emit('update:anchor', key)
}

function onScroll(): void {
  if (!ready) return
  hideHover()
  store.clearHoverTitle()
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    ticking = false
    const el = scrollEl.value
    if (!el) return
    const h = rowHeight.value
    if (!h) return
    if (el.scrollTop < h * 3) prependWeeks()
    else if (el.scrollTop + el.clientHeight > weeks.value.length * h - h * 3) appendWeeks()
    updateTopWeek()
  })
}

function scrollToWeek(week: Dayjs): void {
  const key = week.format('YYYY-MM-DD')
  let index = weeks.value.findIndex((item) => item.key === key)
  if (index < 0) {
    resetRange(week)
    index = BEFORE_WEEKS
    topWeekKey.value = key
    nextTick(() => {
      if (scrollEl.value) scrollEl.value.scrollTop = index * rowHeight.value
    })
    return
  }
  topWeekKey.value = key
  if (scrollEl.value) scrollEl.value.scrollTop = index * rowHeight.value
}

onMounted(() => {
  const initial = anchorWeek()
  resetRange(initial)
  topWeekKey.value = initial.format('YYYY-MM-DD')
  nextTick(() => {
    measure()
    nextTick(() => {
      if (scrollEl.value) scrollEl.value.scrollTop = BEFORE_WEEKS * rowHeight.value
      ready = true
    })
  })

  if (typeof ResizeObserver !== 'undefined' && scrollEl.value) {
    resizeObserver = new ResizeObserver(() => measure())
    resizeObserver.observe(scrollEl.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

watch(
  () => props.anchor,
  (value) => {
    if (!ready) return
    const target = startOfWeek(zoned(`${value}T12:00:00+08:00`, props.config.timeZone))
    if (target.format('YYYY-MM-DD') === topWeekKey.value) return
    scrollToWeek(target)
  },
)
</script>

<template>
  <div class="month-shell">
    <div class="month-weekdays">
      <span v-for="(label, index) in WEEKDAYS_MON" :key="label" :class="{ weekend: index === 5 || index === 6 }">
        {{ label }}
      </span>
    </div>

    <div ref="scrollEl" class="month-scroll" @scroll="onScroll">
      <div
        v-for="week in weeks"
        :key="week.key"
        class="week-row"
        :style="{ height: `${rowHeight}px` }"
      >
        <div
          v-for="day in week.days"
          :key="day.format('YYYY-MM-DD')"
          class="month-cell"
          :class="{
            today: isToday(day),
            weekend: day.day() === 0 || day.day() === 6,
            'first-of-month': day.date() === 1,
          }"
          @click="onCellClick(day)"
        >
          <div class="cell-head">
            <span class="day-number">{{ day.format('D') }}</span>
            <span v-if="day.date() === 1" class="month-label">{{ day.format('M月') }}</span>
          </div>

          <div class="chips">
            <button
              v-for="event in visibleEvents(day)"
              :key="event.id"
              type="button"
              class="chip"
              :class="{
                selected: store.isSelected(event.id),
                'hover-same': store.isCalendarHighlighted(event),
              }"
              :title="`${hm(zoned(event.start, config.timeZone))} ${store.displayTitle(event)}`"
              @click.stop="onChipClick($event, event)"
              @mouseenter="onChipEnter($event, event)"
              @mouseleave="onChipLeave"
            >
              <span class="chip-bar" aria-hidden="true"></span>
              <span class="chip-title">{{ store.displayTitle(event) }}</span>
              <span class="chip-time">{{ hm(zoned(event.start, config.timeZone)) }}</span>
            </button>

            <button
              v-if="extraCount(day) > 0"
              type="button"
              class="more"
              @click.stop="onCellClick(day)"
            >
              +{{ extraCount(day) }}
            </button>
          </div>
        </div>
      </div>
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
  </div>
</template>

<style scoped>
.month-shell {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  background: var(--paper-strong);
}

.month-weekdays {
  display: grid;
  flex: none;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border-bottom: 1px solid var(--line);
  background: var(--panel-soft);
}

.month-weekdays span {
  padding: 8px 4px;
  color: var(--ink-soft);
  font-size: 12px;
  text-align: center;
}

.month-weekdays span.weekend {
  color: var(--red);
}

.month-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  overscroll-behavior: contain;
}

.month-scroll::-webkit-scrollbar {
  display: none;
}

.week-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border-bottom: 1px solid var(--line-soft);
}

.week-row:last-child {
  border-bottom: 0;
}

.month-cell {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex-direction: column;
  padding: 5px 6px 4px;
  border-right: 1px solid var(--line-soft);
  cursor: pointer;
}

.month-cell:last-child {
  border-right: 0;
}

.month-cell:hover {
  background: rgb(255 250 240 / 70%);
}

.month-cell.weekend {
  background: rgb(106 52 36 / 3%);
}

.month-cell.today {
  background: rgb(106 52 36 / 7%);
}

.cell-head {
  display: flex;
  flex: none;
  gap: 5px;
  align-items: center;
  margin-bottom: 3px;
}

.day-number {
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.month-cell.today .day-number {
  display: grid;
  width: 21px;
  height: 21px;
  margin-left: -3px;
  border-radius: 50%;
  background: var(--red);
  color: #fff8ec;
  font-size: 12px;
  place-items: center;
}

.month-label {
  color: var(--red);
  font-size: 10px;
  font-weight: 700;
}

.chips {
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex-direction: column;
  gap: 2px;
}

.chip {
  position: relative;
  display: flex;
  overflow: hidden;
  gap: 5px;
  align-items: center;
  min-height: 20px;
  padding: 1px 5px 1px 2px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease;
}

.chip:hover {
  background: rgb(106 52 36 / 6%);
}

.chip-bar {
  flex: none;
  width: 3px;
  height: 12px;
  border-radius: 2px;
  background: var(--red);
}

.chip-title {
  flex: 1;
  overflow: hidden;
  font-family: var(--font-sans);
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-time {
  flex: none;
  color: var(--muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.chip.selected {
  background: var(--sel-bg);
}

.chip.selected .chip-bar {
  background: var(--sel-line);
}

.chip.hover-same {
  background: var(--hover-same-bg);
}

.chip.hover-same .chip-bar {
  background: var(--hover-same-fg);
}

.chip.hover-same .chip-title {
  color: var(--hover-same-fg);
}

.chip.hover-same .chip-time {
  color: var(--hover-same-fg);
}

.more {
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 10px;
  text-align: left;
}

@media (max-width: 900px) {
  .month-weekdays span {
    padding: 6px 2px;
    font-size: 11px;
  }

  .month-cell {
    padding: 4px 2px 3px;
  }

  .cell-head {
    gap: 3px;
    margin-bottom: 2px;
    padding: 0 1px;
  }

  .day-number {
    font-size: 13px;
  }

  .month-cell.today .day-number {
    width: 18px;
    height: 18px;
    font-size: 10px;
  }

  .month-label {
    font-size: 9px;
  }

  .chips {
    gap: 1px;
  }

  .chip {
    gap: 0;
    align-items: flex-start;
    min-height: 21px;
    padding: 1px 2px 1px 3px;
  }

  .chip-bar {
    display: none;
  }

  .chip-title {
    display: -webkit-box;
    overflow: hidden;
    font-size: 11px;
    line-height: 1.35;
    overflow-wrap: anywhere;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .chip-time {
    display: none;
  }
}
</style>
