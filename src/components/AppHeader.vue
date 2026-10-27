<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, ArrowRight, Calendar, Expand, Fold, FullScreen } from '@element-plus/icons-vue'
import type { CalendarView, FestivalConfig } from '@/types'

const props = defineProps<{
  config: FestivalConfig
  view: CalendarView
  rangeText: string
  showNav: boolean
  panelOpen: boolean
  isFullscreen: boolean
}>()

const emit = defineEmits<{
  'update:view': [value: CalendarView]
  prev: []
  next: []
  today: []
  'toggle-panel': []
  'toggle-fullscreen': []
}>()

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

      <div class="header-tools">
        <el-tooltip :content="panelOpen ? '收起已选日程' : '展开已选日程'" placement="bottom">
          <el-button
            circle
            size="small"
            class="tool-btn"
            :aria-label="panelOpen ? '收起已选' : '展开已选'"
            @click="emit('toggle-panel')"
          >
            <el-icon><Fold v-if="panelOpen" /><Expand v-else /></el-icon>
          </el-button>
        </el-tooltip>

        <el-tooltip :content="isFullscreen ? '退出全屏' : '全屏展示'" placement="bottom">
          <el-button
            circle
            size="small"
            class="tool-btn"
            :aria-label="isFullscreen ? '退出全屏' : '全屏展示'"
            @click="emit('toggle-fullscreen')"
          >
            <el-icon><FullScreen /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
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
  background: var(--paper-strong);
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
  font-size: 23px;
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
  gap: 10px;
  align-items: center;
}

.segmented {
  display: flex;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel-soft);
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
  background: var(--paper-strong);
  box-shadow: 0 2px 8px rgb(80 55 35 / 12%);
  color: var(--red);
  font-weight: 700;
}

.week-nav {
  display: flex;
  gap: 6px;
  align-items: center;
}

.today-btn {
  color: var(--ink-soft);
}

.header-tools {
  display: flex;
  gap: 6px;
  align-items: center;
  padding-left: 4px;
  border-left: 1px solid var(--line-soft);
}

.tool-btn {
  color: var(--ink-soft);
}

.tool-btn:hover {
  color: var(--red);
}

@media (max-width: 1180px) {
  .app-header {
    padding: 10px 16px;
  }

  .brand-text h1 {
    font-size: 20px;
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
    gap: 8px;
    justify-content: space-between;
  }

  .header-tools {
    margin-left: auto;
  }
}
</style>
