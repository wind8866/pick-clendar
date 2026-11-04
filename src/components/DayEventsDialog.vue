<script setup lang="ts">
import { computed } from 'vue'
import type { FestivalConfig, FestivalEvent } from '@/types'
import { useSelectionStore } from '@/stores/selection'
import { compareStart, dateInZone, eventEnd, hm, toDateKey, weekdayLabel, zoned } from '@/utils/time'
import { hallColor } from '@/utils/halls'

const props = defineProps<{
  modelValue: boolean
  date: string
  config: FestivalConfig
  /** 影厅筛选，空数组表示全部 */
  halls?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [event: FestivalEvent]
}>()

const store = useSelectionStore()

const day = computed(() => (props.date ? dateInZone(props.date, props.config.timeZone) : null))

function matchesHall(event: FestivalEvent): boolean {
  if (!props.halls?.length) return true
  return !event.location || props.halls.includes(event.location)
}

const events = computed(() =>
  props.config.events
    .filter(
      (event) =>
        event.kind !== 'header' &&
        matchesHall(event) &&
        toDateKey(event.start, props.config.timeZone) === props.date,
    )
    .sort((a, b) => compareStart(a.start, b.start)),
)

function pickDay(event: FestivalEvent): void {
  emit('select', event)
}

/** 多厅日历：厅色小方块，和日历左侧竖线保持一致 */
function hallDot(event: FestivalEvent): string | undefined {
  return hallColor(props.config, event.location)
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="min(420px, 92vw)"
    align-center
    class="day-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div v-if="day" class="day-head">
        <span>{{ day.format('YYYY-MM-DD') }}</span>
        <span>{{ weekdayLabel(day) }}</span>
        <span class="day-count">{{ events.length }} 场</span>
      </div>
    </template>

    <div class="day-list">
      <button
        v-for="event in events"
        :key="event.id"
        class="day-row"
        :class="{ selected: store.isSelected(event.id) }"
        type="button"
        @click="pickDay(event)"
      >
        <span class="day-time">
          <span>
            {{ hm(zoned(event.start, config.timeZone)) }} –
            {{ hm(eventEnd(event.start, event.durationMinutes, config.timeZone)) }}
          </span>
          <span v-if="event.location" class="day-hall">
            <span
              v-if="hallDot(event)"
              class="hall-dot"
              :style="{ background: hallDot(event) }"
              aria-hidden="true"
            />
            {{ event.location }}
          </span>
        </span>
        <span class="day-title">{{ store.displayTitle(event) }}</span>
        <span class="day-action">
          {{ store.isSelected(event.id) ? '移出' : '加入' }}
        </span>
      </button>
    </div>
  </el-dialog>
</template>

<style scoped>
.day-head {
  display: flex;
  gap: 8px;
  align-items: baseline;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 700;
}

.day-head span:nth-child(2) {
  color: var(--red);
  font-size: 14px;
}

.day-count {
  margin-left: auto;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 12px;
  font-weight: 400;
}

.day-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.day-row {
  display: grid;
  grid-template-columns: 94px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: var(--paper-strong);
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.day-row:hover {
  border-color: var(--red);
}

.day-row.selected {
  border-color: var(--red);
  background: var(--red-soft);
}

.day-time {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--red);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.day-hall {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  color: var(--muted);
  font-size: 10px;
}

.hall-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 2px;
}

.day-title {
  overflow: hidden;
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-action {
  color: var(--muted);
  font-size: 11px;
}
</style>
