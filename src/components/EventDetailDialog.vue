<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, Link, Location } from '@element-plus/icons-vue'
import type { FestivalConfig, FestivalEvent } from '@/types'
import { useSelectionStore } from '@/stores/selection'
import { eventEnd, formatDuration, hm, weekdayLabel, zoned } from '@/utils/time'

const props = defineProps<{
  modelValue: boolean
  event: FestivalEvent | null
  config: FestivalConfig
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const store = useSelectionStore()
const selected = computed(() => (props.event ? store.isSelected(props.event.id) : false))
const start = computed(() => (props.event ? zoned(props.event.start, props.config.timeZone) : null))
const end = computed(() => {
  if (!props.event) return null
  return eventEnd(props.event.start, props.event.durationMinutes, props.config.timeZone)
})

function close(): void {
  emit('update:modelValue', false)
}

function toggle(): void {
  if (!props.event) return
  store.toggle(props.event.id)
  close()
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="min(460px, 92vw)"
    align-center
    :show-close="true"
    class="detail-dialog"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('update:modelValue', false)"
  >
    <template #header>
      <div class="detail-kicker">
        <span>日程详情</span>
        <span v-if="selected" class="detail-badge">已加入</span>
      </div>
    </template>

    <div v-if="event" class="detail-body">
      <h2>{{ event.title }}</h2>

      <div class="detail-meta">
        <el-icon><Calendar /></el-icon>
        <div>
          <p class="detail-time">
            {{ start ? start.format('YYYY-MM-DD') : '' }}
            {{ start ? weekdayLabel(start) : '' }}
          </p>
          <p class="detail-time">
            {{ start ? hm(start) : '' }} – {{ end ? hm(end) : '' }}
            <span class="detail-duration">（{{ formatDuration(event.durationMinutes) }}）</span>
          </p>
        </div>
      </div>

      <p class="detail-desc">{{ event.description }}</p>

      <div v-if="config.venue" class="detail-venue">
        <el-icon><Location /></el-icon>
        <span>{{ config.venue }}<template v-if="config.venueAddress"> · {{ config.venueAddress }}</template></span>
      </div>

      <a
        v-if="event.url"
        class="detail-link"
        :href="event.url"
        target="_blank"
        rel="noopener noreferrer"
      >
        <el-icon><Link /></el-icon>
        <span>{{ event.url }}</span>
      </a>
    </div>

    <template #footer>
      <el-button @click="close">关闭</el-button>
      <el-button :type="selected ? 'danger' : 'primary'" @click="toggle">
        {{ selected ? '移除日程' : '加入日程' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.detail-kicker {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.detail-badge {
  padding: 1px 7px;
  border-radius: 99px;
  background: var(--red-soft);
  color: var(--red);
  letter-spacing: 0;
}

.detail-body h2 {
  margin-bottom: 16px;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 26px;
  line-height: 1.35;
}

.detail-meta {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  color: var(--ink-soft);
}

.detail-meta .el-icon {
  margin-top: 3px;
  color: var(--red);
}

.detail-time {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.detail-duration {
  color: var(--muted);
  font-size: 12px;
}

.detail-desc {
  margin-top: 14px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #f2e9da;
  color: var(--ink-soft);
  font-size: 13px;
  line-height: 1.7;
}

.detail-venue,
.detail-link {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: 12px;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.6;
}

.detail-venue .el-icon,
.detail-link .el-icon {
  margin-top: 2px;
  flex: none;
  color: var(--muted);
}

.detail-link {
  color: var(--red);
  word-break: break-all;
}

.detail-link:hover {
  text-decoration: underline;
}
</style>
