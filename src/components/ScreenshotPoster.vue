<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FestivalConfig, FestivalEvent } from '@/types'
import { useSelectionStore } from '@/stores/selection'
import {
  eventEnd,
  hm,
  weekdayLabel,
  zoned,
} from '@/utils/time'

const props = defineProps<{
  config: FestivalConfig
}>()

const store = useSelectionStore()
const root = ref<HTMLElement | null>(null)

interface PosterGroup {
  date: string
  dayLabel: string
  weekday: string
  items: Array<{ event: FestivalEvent; start: string; end: string; travel: number }>
}

const groups = computed<PosterGroup[]>(() => {
  const map = new Map<string, PosterGroup>()
  for (const event of store.selectedEvents) {
    const start = zoned(event.start, props.config.timeZone)
    const end = eventEnd(event.start, event.durationMinutes, props.config.timeZone)
    const key = start.format('YYYY-MM-DD')
    let group = map.get(key)
    if (!group) {
      group = {
        date: key,
        dayLabel: start.format('MM/DD'),
        weekday: weekdayLabel(start),
        items: [],
      }
      map.set(key, group)
    }
    group.items.push({
      event,
      start: hm(start),
      end: hm(end),
      travel: store.effectiveTravelOf(event),
    })
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
})

const dateRange = computed(() => {
  if (!props.config.events.length) return ''
  const starts = props.config.events.map((event) => event.start).sort()
  const first = zoned(starts[0], props.config.timeZone)
  const last = zoned(starts[starts.length - 1], props.config.timeZone)
  return `${first.format('YYYY-MM-DD')} – ${last.format('MM-DD')}`
})

function metaLine(event: FestivalEvent): string {
  const parts: string[] = []
  if (event.year !== undefined) parts.push(`${event.year}年`)
  if (event.language) parts.push(event.language)
  if (event.director) parts.push(event.director.replace(/ \/ /g, '/'))
  return parts.join(' ')
}

defineExpose({ root })
</script>

<template>
  <div ref="root" class="poster">
    <div class="poster-glow" aria-hidden="true" />

    <header class="poster-head">
      <p class="poster-kicker">
        <span v-if="config.city">{{ config.city }}</span>
        <span v-if="config.city && config.venue"> · </span>
        <span v-if="config.venue">{{ config.venue }}</span>
      </p>
      <h1>{{ config.name }}</h1>
      <div class="poster-meta">
        <span>{{ dateRange }}</span>
        <span class="poster-count">已选 {{ store.selectedCount }} {{ config.itemNoun }}</span>
      </div>
    </header>

    <div class="poster-rule" />

    <section v-for="group in groups" :key="group.date" class="poster-group">
      <div class="poster-day">
        <span class="poster-day-date">{{ group.dayLabel }}</span>
        <span class="poster-day-week">{{ group.weekday }}</span>
      </div>

      <div
        v-for="item in group.items"
        :key="item.event.id"
        class="poster-item"
      >
        <span class="poster-time">{{ item.start }} – {{ item.end }}</span>
        <span class="poster-prefix">{{ item.event.titlePrefix ?? '' }}</span>
        <div class="poster-main">
          <span class="poster-title">{{ item.event.title }}</span>
          <span class="poster-sub">{{ metaLine(item.event) }}</span>
        </div>
        <span v-if="item.travel > 0" class="poster-travel">路程 {{ item.travel }} 分钟</span>
      </div>
    </section>

    <footer class="poster-foot">
      <span v-if="config.venueAddress">{{ config.venueAddress }}</span>
      <span>共 {{ store.selectedCount }} {{ config.itemNoun }}</span>
    </footer>
  </div>
</template>

<style scoped>
.poster {
  position: relative;
  overflow: hidden;
  width: 750px;
  padding: 34px 40px 30px;
  background:
    radial-gradient(circle at 88% -4%, rgb(200 161 90 / 18%), transparent 36%),
    radial-gradient(circle at 0% 100%, rgb(140 47 47 / 7%), transparent 42%),
    #fbf7ee;
  color: var(--ink);
  font-family: var(--font-sans);
}

.poster-glow {
  position: absolute;
  top: -110px;
  right: -90px;
  width: 260px;
  height: 260px;
  border: 1px solid rgb(140 47 47 / 16%);
  border-radius: 50%;
}

.poster-head {
  position: relative;
}

.poster-kicker {
  color: var(--red);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.16em;
}

.poster-head h1 {
  margin-top: 12px;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.25;
}

.poster-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14px;
  color: var(--muted);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.poster-count {
  color: var(--red);
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 700;
}

.poster-rule {
  height: 1px;
  margin: 16px 0 6px;
  background: linear-gradient(90deg, var(--red), rgb(140 47 47 / 10%));
}

.poster-group {
  padding-top: 10px;
}

.poster-day {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--line);
}

.poster-day-date {
  color: var(--red);
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.poster-day-week {
  color: var(--ink-soft);
  font-size: 14px;
}

.poster-item {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 7px 0;
  border-bottom: 1px dashed var(--line-soft);
}

.poster-item:last-child {
  border-bottom: 0;
}

.poster-time {
  flex: none;
  width: 118px;
  padding-top: 3px;
  color: var(--red);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.poster-prefix {
  flex: none;
  width: 1.3em;
  padding-top: 3px;
  color: var(--red);
  font-size: 16px;
  text-align: center;
}

.poster-main {
  flex: 1;
  min-width: 0;
}

.poster-title {
  display: block;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
}

.poster-sub {
  display: block;
  margin-top: 2px;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.5;
}

.poster-travel {
  flex: none;
  padding-top: 3px;
  color: var(--muted);
  font-size: 12px;
}

.poster-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 30px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 12px;
}
</style>
