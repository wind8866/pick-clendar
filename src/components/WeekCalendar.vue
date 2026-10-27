<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Dayjs } from 'dayjs'
import type { FestivalConfig, FestivalEvent } from '@/types'
import { useSelectionStore } from '@/stores/selection'
import { useEventHover } from '@/composables/useEventHover'
import {
  dayjs,
  hm,
  startOfWeek,
  toDateKey,
  weekdayLabel,
  zoned,
} from '@/utils/time'
import EventHoverCard from '@/components/EventHoverCard.vue'

const props = defineProps<{
  config: FestivalConfig
  anchor: string
}>()

const store = useSelectionStore()
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

const weekStart = computed<Dayjs>(() =>
  startOfWeek(zoned(`${props.anchor}T12:00:00+08:00`, props.config.timeZone)),
)
const days = computed(() =>
  Array.from({ length: 7 }, (_, index) => weekStart.value.add(index, 'day')),
)
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

function timeRangeText(event: FestivalEvent): string {
  const start = zoned(event.start, props.config.timeZone)
  const end = start.add(event.durationMinutes, 'minute')
  return `${hm(start)}–${hm(end)}`
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

function onEnter(mouse: MouseEvent, event: FestivalEvent): void {
  showHover(event, mouse.clientX, mouse.clientY)
  store.setHoverTitle(event.title)
}

function onLeave(): void {
  scheduleHide()
  store.scheduleHideHoverTitle()
}

function onHoverPick(): void {
  if (hoverEvent.value) store.toggle(hoverEvent.value.id)
}

function onClick(event: FestivalEvent): void {
  store.toggle(event.id)
  hideHover()
  store.clearHoverTitle()
}

const now = ref(dayjs())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    now.value = dayjs()
  }, 30_000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
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

function onScroll(): void {
  hideHover()
  store.clearHoverTitle()
}
</script>

<template>
  <div class="week-shell">
    <div class="week-scroll" @scroll="onScroll">
      <div class="week-inner">
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
                  <span class="event-time">{{ timeRangeText(event) }}</span>
                  <span class="event-title">{{ store.displayTitle(event) }}</span>
                  <span v-if="directorYear(event)" class="event-sub">{{ directorYear(event) }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <EventHoverCard
      v-if="hoverEvent"
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
.week-shell {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.week-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.week-inner {
  display: flex;
  min-width: 780px;
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
  width: 58px;
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
  display: grid;
  flex: 1;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.day-head {
  display: flex;
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
  width: 58px;
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
  display: grid;
  flex: 1;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.day-col {
  position: relative;
  min-width: 0;
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
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 700;
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

@media (max-width: 900px) {
  .week-inner {
    min-width: 0;
  }

  .week-canvas {
    min-height: 580px;
  }

  .weekday {
    font-size: 11px;
  }

  .date {
    font-size: 13px;
  }
}
</style>
