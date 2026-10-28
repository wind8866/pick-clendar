<script setup lang="ts">
import { computed } from 'vue'
import type { FestivalConfig, FestivalEvent } from '@/types'
import { useSelectionStore } from '@/stores/selection'
import { eventEnd, formatDuration, hm, zoned } from '@/utils/time'

const props = defineProps<{
  event: FestivalEvent
  config: FestivalConfig
  selected: boolean
  /** 移动端弹窗中在「加入 / 移出」旁边显示关闭按钮 */
  showClose?: boolean
}>()

const emit = defineEmits<{
  pick: []
  close: []
}>()

const store = useSelectionStore()
const start = computed(() => hm(zoned(props.event.start, props.config.timeZone)))
const end = computed(() =>
  hm(eventEnd(props.event.start, props.event.durationMinutes, props.config.timeZone)),
)
const title = computed(() => store.displayTitle(props.event))
const meta = computed(() => store.descriptionOf(props.event, true))
const urlHost = computed(() => {
  try {
    return new URL(props.event.url).host
  } catch {
    return ''
  }
})

// 同片未来场次（晚于当前场），用于详情展示
const futureSiblings = computed(() =>
  props.config.events
    .filter(
      (event) =>
        event.kind !== 'header' &&
        event.title === props.event.title &&
        event.id !== props.event.id &&
        event.start > props.event.start,
    )
    .sort((a, b) => a.start.localeCompare(b.start)),
)

function siblingLabel(event: FestivalEvent): string {
  const d = zoned(event.start, props.config.timeZone)
  return `${d.format('MM/DD')} ${d.format('HH:mm')}`
}
</script>

<template>
  <div class="event-card" :class="{ 'has-close': showClose }">
    <div class="card-head">
      <a
        v-if="event.url"
        class="card-title-link"
        :href="event.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <h4>{{ title }}</h4>
      </a>
      <h4 v-else>{{ title }}</h4>
      <span class="card-status" :class="{ selected }">{{ selected ? '已加入' : '未加入' }}</span>
    </div>
    <p class="card-time">{{ start }} – {{ end }} · {{ formatDuration(event.durationMinutes) }}</p>
    <p v-if="meta" class="card-desc">{{ meta }}</p>
    <p v-if="event.weekDesc" class="card-week">{{ event.weekDesc }}</p>

    <div v-if="futureSiblings.length" class="card-siblings">
      <p class="card-siblings-head">同片场次</p>
      <p v-for="sibling in futureSiblings" :key="sibling.id" class="card-sibling">
        {{ siblingLabel(sibling) }}
      </p>
    </div>

    <a
      v-if="event.url"
      class="card-url"
      :href="event.url"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ urlHost }}
    </a>

    <div class="card-actions">
      <button type="button" class="card-action" :class="{ selected }" @click="emit('pick')">
        {{ selected ? '移出' : '加入' }}
      </button>
      <button v-if="showClose" type="button" class="card-close" @click="emit('close')">
        关闭
      </button>
    </div>
  </div>
</template>

<style scoped>
.event-card {
  width: 100%;
  padding: 14px 16px 13px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgb(248 241 231 / 0.86);
  backdrop-filter: blur(8px);
  box-shadow: 0 16px 46px rgb(61 38 25 / 22%);
  pointer-events: auto;
}

.event-card.has-close {
  background: rgb(248 241 231 / 0.97);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.card-title-link {
  flex: 1;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.card-head h4 {
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.35;
}

.card-title-link h4:hover {
  color: var(--red);
  text-decoration: underline;
}

.card-status {
  flex: none;
  padding: 2px 7px;
  border-radius: 99px;
  background: var(--panel-soft);
  color: var(--muted);
  font-size: 11px;
}

.card-status.selected {
  background: var(--sel-bg);
  color: var(--ink);
}

.card-time {
  margin-top: 7px;
  color: var(--red);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.card-desc {
  margin-top: 6px;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-line;
}

.card-week {
  margin-top: 6px;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.55;
}

.card-siblings {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--panel-soft);
}

.card-siblings-head {
  color: var(--ink-soft);
  font-size: 11px;
  font-weight: 700;
}

.card-sibling {
  margin-top: 3px;
  color: var(--ink-soft);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}

.card-url {
  display: inline-block;
  overflow: hidden;
  max-width: 100%;
  margin-top: 7px;
  color: var(--red);
  font-size: 11px;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-url:hover {
  text-decoration: underline;
}

.card-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.card-action {
  flex: 1;
  padding: 7px 0;
  border: 1px solid var(--red);
  border-radius: 7px;
  background: var(--red);
  color: #fff8ec;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.card-action:hover {
  background: var(--red-deep);
}

.card-action.selected {
  background: transparent;
  color: var(--red);
}

.card-action.selected:hover {
  background: var(--red-soft);
}

.card-close {
  flex: none;
  padding: 7px 14px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.card-close:hover {
  background: var(--panel-soft);
}
</style>
