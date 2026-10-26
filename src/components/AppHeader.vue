<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, ArrowRight, Calendar } from '@element-plus/icons-vue'
import type { CalendarView, FestivalConfig } from '@/types'

const props = defineProps<{
  config: FestivalConfig
  view: CalendarView
  mode: 'browse' | 'select'
  rangeText: string
  showNav: boolean
}>()

const emit = defineEmits<{
  'update:view': [value: CalendarView]
  'update:mode': [value: 'browse' | 'select']
  prev: []
  next: []
  today: []
}>()

const selectMode = computed({
  get: () => props.mode === 'select',
  set: (value: boolean) => emit('update:mode', value ? 'select' : 'browse'),
})

const subtitle = computed(() => {
  const parts = [props.config.city, props.config.venue].filter(Boolean)
  return parts.join(' · ')
})
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true">日</div>
      <div class="brand-text">
        <h1>{{ config.name }}</h1>
        <p>
          <span v-if="subtitle">{{ subtitle }}</span>
          <span v-if="subtitle" class="dot">·</span>
          <span class="range">{{ rangeText }}</span>
        </p>
      </div>
    </div>

    <div class="controls">
      <div class="segmented" role="group" aria-label="视图切换">
        <button
          type="button"
          :class="{ active: view === 'week' }"
          @click="emit('update:view', 'week')"
        >
          周
        </button>
        <button
          type="button"
          :class="{ active: view === 'month' }"
          @click="emit('update:view', 'month')"
        >
          月
        </button>
      </div>

      <div class="mode-switch">
        <span :class="{ active: mode === 'browse' }">展示</span>
        <el-switch v-model="selectMode" aria-label="切换展示模式或选择模式" />
        <span :class="{ active: mode === 'select' }">选择</span>
      </div>

      <div v-if="showNav" class="week-nav">
        <el-button circle size="small" aria-label="上一周" @click="emit('prev')">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <el-button size="small" class="today-btn" @click="emit('today')">
          <el-icon><Calendar /></el-icon>
          今天
        </el-button>
        <el-button circle size="small" aria-label="下一周" @click="emit('next')">
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
      <el-button v-else size="small" class="today-btn" @click="emit('today')">
        <el-icon><Calendar /></el-icon>
        今天
      </el-button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  z-index: 20;
  display: flex;
  flex: none;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  min-height: 68px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--line);
  background:
    linear-gradient(90deg, rgb(255 255 255 / 55%), transparent 42%),
    rgb(247 241 230 / 92%);
  backdrop-filter: blur(10px);
}

.brand {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.brand-mark {
  display: grid;
  flex: none;
  width: 38px;
  height: 38px;
  border: 1px solid var(--red);
  border-radius: 50%;
  color: var(--red);
  font-family: var(--font-serif);
  font-size: 19px;
  place-items: center;
}

.brand-text {
  min-width: 0;
}

.brand-text h1 {
  overflow: hidden;
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-text p {
  overflow: hidden;
  margin-top: 2px;
  color: var(--muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dot {
  margin: 0 6px;
}

.range {
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

.controls {
  display: flex;
  flex: none;
  gap: 14px;
  align-items: center;
}

.segmented {
  display: flex;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ece2d2;
}

.segmented button {
  min-width: 42px;
  padding: 5px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.segmented button.active {
  background: var(--panel-soft);
  box-shadow: 0 2px 8px rgb(80 55 35 / 12%);
  color: var(--red);
  font-weight: 700;
}

.mode-switch {
  display: flex;
  gap: 7px;
  align-items: center;
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.mode-switch span.active {
  color: var(--red);
  font-weight: 700;
}

.mode-switch :deep(.el-switch) {
  --el-switch-on-color: var(--red);
  --el-switch-off-color: #b5a48f;
}

.week-nav {
  display: flex;
  gap: 6px;
  align-items: center;
}

.today-btn {
  color: var(--ink-soft);
}

@media (max-width: 1180px) {
  .app-header {
    padding: 10px 16px;
  }

  .brand-text h1 {
    font-size: 19px;
  }

  .controls {
    gap: 9px;
  }
}

@media (max-width: 900px) {
  .app-header {
    flex-wrap: wrap;
    gap: 9px 12px;
    min-height: 0;
    padding: 10px 14px 11px;
  }

  .brand {
    width: 100%;
  }

  .brand-mark {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }

  .brand-text h1 {
    font-size: 18px;
  }

  .brand-text p {
    font-size: 11px;
  }

  .controls {
    width: 100%;
    gap: 10px;
    justify-content: space-between;
  }

  .mode-switch {
    margin-left: auto;
  }

  .week-nav {
    margin-left: auto;
  }
}
</style>
