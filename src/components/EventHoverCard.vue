<script setup lang="ts">
import { computed } from 'vue'
import type { FestivalConfig, FestivalEvent } from '@/types'
import { useSelectionStore } from '@/stores/selection'
import { eventEnd, formatDuration, hm } from '@/utils/time'

const props = defineProps<{
  event: FestivalEvent
  config: FestivalConfig
  selected: boolean
  x: number
  y: number
}>()

const emit = defineEmits<{
  enter: []
  leave: []
  pick: []
}>()

const store = useSelectionStore()
const start = computed(() => hm(eventEnd(props.event.start, 0, props.config.timeZone)))
const end = computed(() =>
  hm(eventEnd(props.event.start, props.event.durationMinutes, props.config.timeZone)),
)
const title = computed(() => store.displayTitle(props.event))
const meta = computed(() => store.composedMeta(props.event))
const urlHost = computed(() => {
  try {
    return new URL(props.event.url).host
  } catch {
    return ''
  }
})
const position = computed(() => {
  const width = 320
  const height = 250
  const left = Math.max(8, Math.min(props.x + 16, window.innerWidth - width - 8))
  const top = Math.max(8, Math.min(props.y + 16, window.innerHeight - height - 8))
  return { left: `${left}px`, top: `${top}px` }
})
</script>

<template>
  <Teleport to="body">
    <div
      class="hover-card"
      :style="position"
      @mouseenter="emit('enter')"
      @mouseleave="emit('leave')"
    >
      <div class="hover-head">
        <h4>{{ title }}</h4>
        <span class="hover-status" :class="{ selected }">{{ selected ? '已加入' : '未加入' }}</span>
      </div>
      <p class="hover-time">{{ start }} – {{ end }} · {{ formatDuration(event.durationMinutes) }}</p>
      <p v-if="meta" class="hover-desc">{{ meta }}</p>
      <p v-if="event.weekDesc" class="hover-week">{{ event.weekDesc }}</p>
      <p v-if="urlHost" class="hover-url">{{ urlHost }}</p>
      <button type="button" class="hover-action" :class="{ selected }" @click="emit('pick')">
        {{ selected ? '移出已选' : '加入已选' }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.hover-card {
  position: fixed;
  z-index: 3000;
  width: 320px;
  padding: 14px 16px 13px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--paper-strong);
  box-shadow: 0 16px 46px rgb(61 38 25 / 22%);
  pointer-events: auto;
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
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
}

.hover-status {
  flex: none;
  padding: 2px 7px;
  border-radius: 99px;
  background: var(--panel-soft);
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
  font-family: var(--font-serif);
  font-size: 13px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.hover-week {
  margin-top: 6px;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.55;
}

.hover-url {
  overflow: hidden;
  margin-top: 5px;
  color: var(--muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hover-action {
  width: 100%;
  margin-top: 10px;
  padding: 7px 0;
  border: 1px solid var(--red);
  border-radius: 7px;
  background: var(--red);
  color: #fff8ec;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.hover-action:hover {
  background: var(--red-deep);
}

.hover-action.selected {
  background: transparent;
  color: var(--red);
}

.hover-action.selected:hover {
  background: var(--red-soft);
}
</style>
