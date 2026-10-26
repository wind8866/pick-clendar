<script setup lang="ts">
import { computed } from 'vue'
import type { FestivalConfig, FestivalEvent } from '@/types'
import { eventEnd, formatDuration, hm } from '@/utils/time'

const props = defineProps<{
  event: FestivalEvent
  config: FestivalConfig
  selected: boolean
  x: number
  y: number
}>()

const start = computed(() => hm(eventEnd(props.event.start, 0, props.config.timeZone)))
const end = computed(() => hm(eventEnd(props.event.start, props.event.durationMinutes, props.config.timeZone)))
const urlHost = computed(() => {
  try {
    return new URL(props.event.url).host
  } catch {
    return ''
  }
})
const position = computed(() => {
  const width = 300
  const height = 210
  const left = Math.max(8, Math.min(props.x + 16, window.innerWidth - width - 8))
  const top = Math.max(8, Math.min(props.y + 16, window.innerHeight - height - 8))
  return { left: `${left}px`, top: `${top}px` }
})
</script>

<template>
  <Teleport to="body">
    <div class="hover-card" :style="position">
      <div class="hover-head">
        <h4>{{ event.title }}</h4>
        <span class="hover-status" :class="{ selected }">{{ selected ? '已加入' : '未加入' }}</span>
      </div>
      <p class="hover-time">{{ start }} – {{ end }} · {{ formatDuration(event.durationMinutes) }}</p>
      <p class="hover-desc">{{ event.description }}</p>
      <p v-if="urlHost" class="hover-url">{{ urlHost }}</p>
      <p class="hover-hint">{{ selected ? '点击移出已选' : '点击加入已选' }}</p>
    </div>
  </Teleport>
</template>

<style scoped>
.hover-card {
  position: fixed;
  z-index: 3000;
  width: 300px;
  padding: 13px 15px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--panel-soft);
  box-shadow: 0 16px 46px rgb(61 38 25 / 20%);
  pointer-events: none;
}

.hover-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.hover-head h4 {
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.35;
}

.hover-status {
  flex: none;
  padding: 2px 7px;
  border-radius: 99px;
  background: #ece2d2;
  color: var(--muted);
  font-size: 11px;
}

.hover-status.selected {
  background: var(--red-soft);
  color: var(--red);
}

.hover-time {
  margin-top: 7px;
  color: var(--red);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.hover-desc {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 6px;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.hover-url {
  overflow: hidden;
  margin-top: 5px;
  color: var(--muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hover-hint {
  margin-top: 9px;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
  color: var(--muted);
  font-size: 11px;
}
</style>
