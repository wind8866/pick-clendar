<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FestivalConfig, FestivalEvent } from '@/types'
import { useSelectionStore } from '@/stores/selection'
import { eventEnd, hm, weekdayLabel, zoned } from '@/utils/time'

const props = defineProps<{
  config: FestivalConfig
  footerText?: string
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

const hasPrefix = computed(() => store.selectedEvents.some((event) => event.titlePrefix))

const dateRange = computed(() => {
  if (!props.config.events.length) return ''
  const starts = props.config.events.map((event) => event.start).sort()
  const first = zoned(starts[0], props.config.timeZone)
  const last = zoned(starts[starts.length - 1], props.config.timeZone)
  return `${first.format('YYYY-MM-DD')} – ${last.format('MM-DD')}`
})

const qrSrc = `${import.meta.env.BASE_URL}qrcode/${props.config.id}.svg`

defineExpose({ root })
</script>

<template>
  <div ref="root" class="poster">
    <header class="poster-head">
      <p class="poster-kicker">
        <span v-if="config.city">{{ config.city }}</span>
        <span v-if="config.city && config.venue"> · </span>
        <span v-if="config.venue">{{ config.venue }}</span>
      </p>
      <h1>{{ config.name }}</h1>
      <p class="poster-date">{{ dateRange }}</p>
    </header>

    <section v-for="group in groups" :key="group.date" class="poster-group">
      <div class="poster-day">
        <span class="poster-day-date">{{ group.dayLabel }}</span>
        <span class="poster-day-week">{{ group.weekday }}</span>
      </div>

      <div v-for="item in group.items" :key="item.event.id" class="poster-item">
        <span class="poster-time">{{ item.start }} – {{ item.end }}</span>
        <span v-if="hasPrefix" class="poster-prefix">{{ item.event.titlePrefix ?? '' }}</span>
        <div class="poster-main">
          <span class="poster-title">{{ item.event.title }}</span>
          <span class="poster-sub">{{ store.descriptionOf(item.event) }}</span>
        </div>
        <span v-if="item.travel > 0" class="poster-travel">行程 {{ item.travel }} 分钟</span>
      </div>
    </section>

    <footer class="poster-foot">
      <img class="poster-qr" :src="qrSrc" alt="扫码查看日程" />
      <span v-if="footerText" class="poster-foot-text">{{ footerText }}</span>
    </footer>
  </div>
</template>

<style scoped>
.poster {
  position: relative;
  overflow: hidden;
  width: 393px;
  padding: 20px 20px 16px;
  background: #fbf7ee;
  color: var(--ink);
  font-family: var(--font-sans);
}

.poster-head {
  position: relative;
}

.poster-kicker {
  color: var(--red);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.poster-head h1 {
  margin-top: 6px;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.3;
}

.poster-date {
  margin-top: 6px;
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.poster-group {
  padding-top: 12px;
}

.poster-day {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--line-soft);
}

.poster-day-date {
  color: var(--red);
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.poster-day-week {
  color: var(--ink-soft);
  font-size: 11px;
}

.poster-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  padding: 6px 0;
}

.poster-time {
  flex: none;
  width: 86px;
  padding-top: 2px;
  color: var(--red);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.poster-prefix {
  flex: none;
  width: 1em;
  padding-top: 2px;
  color: var(--red);
  font-size: 13px;
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
  font-size: 15px;
  font-weight: 700;
  line-height: 1.35;
}

.poster-sub {
  display: block;
  margin-top: 1px;
  color: var(--ink-soft);
  font-size: 10.5px;
  line-height: 1.45;
  white-space: pre-line;
}

.poster-travel {
  flex: none;
  padding-top: 2px;
  color: var(--muted);
  font-size: 10px;
}

.poster-foot {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 10px;
}

.poster-qr {
  flex: none;
  width: 46px;
  height: 46px;
}

.poster-foot-text {
  flex: 1;
  color: var(--ink-soft);
  font-size: 10px;
  line-height: 1.5;
  text-align: right;
}
</style>
