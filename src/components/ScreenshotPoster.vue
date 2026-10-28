<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FestivalConfig, FestivalEvent } from '@/types'
import { useSelectionStore } from '@/stores/selection'
import { eventEnd, hm, weekdayLabel, zoned } from '@/utils/time'

const props = defineProps<{
  config: FestivalConfig
  footerText?: string
  capturedAt?: string
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

const qrSrc = `${import.meta.env.BASE_URL}qrcode/${props.config.id}.svg`

defineExpose({ root })
</script>

<template>
  <div ref="root" class="poster">
    <header class="poster-head">
      <div class="poster-head-main">
        <h1 class="poster-title-main">{{ config.name }}</h1>
        <p class="poster-venue">
          <span v-if="config.city">{{ config.city }}</span>
          <span v-if="config.city && config.venue"> · </span>
          <span v-if="config.venue">{{ config.venue }}</span>
        </p>
        <p v-if="footerText" class="poster-note">{{ footerText }}</p>
      </div>

      <div class="poster-qr-box">
        <img class="poster-qr" :src="qrSrc" alt="创建排片表" />
        <span class="poster-qr-hint">创建排片表</span>
      </div>
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

    <footer v-if="capturedAt" class="poster-foot">
      <span class="poster-foot-time">{{ capturedAt }}</span>
    </footer>
  </div>
</template>

<style scoped>
.poster {
  position: relative;
  overflow: hidden;
  width: 393px;
  padding: 0 0 16px;
  background: #fbf7ee;
  color: var(--ink);
  font-family: var(--font-sans);
}

/* 电影票头部 */
.poster-head {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 20px 22px;
  background: #6a3424;
  color: #fbf7ee;
}

.poster-head::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 10px;
  background: radial-gradient(circle at 7px 10px, #fbf7ee 6px, transparent 6.5px);
  background-repeat: repeat-x;
  background-size: 14px 10px;
  pointer-events: none;
}

.poster-head-main {
  min-width: 0;
  flex: 1;
}

.poster-title-main {
  color: #fbf7ee;
  font-family: var(--font-serif);
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.3;
}

.poster-venue {
  margin-top: 6px;
  color: rgb(251 247 238 / 82%);
  font-size: 11px;
}

.poster-note {
  margin-top: 3px;
  color: rgb(251 247 238 / 78%);
  font-size: 11px;
  line-height: 1.4;
}

.poster-qr-box {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.poster-qr {
  width: 52px;
  height: 52px;
  border-radius: 4px;
  background: #ffffff;
}

.poster-qr-hint {
  color: rgb(251 247 238 / 80%);
  font-size: 9px;
  white-space: nowrap;
}

.poster-group {
  padding: 12px 20px 0;
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
  justify-content: flex-end;
  margin-top: 16px;
  padding: 0 20px;
}

.poster-foot-time {
  color: var(--muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}
</style>
