<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, Expand, Fold, FullScreen } from '@element-plus/icons-vue'
import type { FestivalConfig } from '@/types'
import { staticPath } from '@/utils/site'

const props = defineProps<{
  config: FestivalConfig
  panelOpen: boolean
  isFullscreen: boolean
}>()

const emit = defineEmits<{
  'toggle-panel': []
  'toggle-fullscreen': []
}>()

const subtitle = computed(() => {
  const parts = [props.config.city, props.config.venue].filter(Boolean)
  return parts.join(' · ')
})

const logoUrl = staticPath('logo.svg')
</script>

<template>
  <header class="app-header">
    <router-link to="/pick" class="back-link" aria-label="全部影展" title="全部影展">
      <el-icon><ArrowLeft /></el-icon>
      <span class="back-text">全部影展</span>
    </router-link>

    <div class="brand">
      <img class="brand-logo" :src="logoUrl" alt="" aria-hidden="true" />
      <div class="brand-text">
        <h1>{{ config.name }}</h1>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
    </div>

    <div class="header-tools">
      <el-tooltip
        :content="panelOpen ? '收起已选日程' : '展开已选日程'"
        placement="bottom"
        popper-class="header-tip"
      >
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

      <el-tooltip
        :content="isFullscreen ? '退出全屏' : '全屏展示'"
        placement="bottom"
        popper-class="header-tip"
      >
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
  </header>
</template>

<style scoped>
.app-header {
  z-index: 20;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-start;
  gap: 20px;
  min-height: 68px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--line);
  background: var(--paper-strong);
  backdrop-filter: blur(10px);
}

.back-link {
  display: inline-flex;
  flex: none;
  gap: 4px;
  align-items: center;
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--ink-soft);
  font-size: 12px;
  text-decoration: none;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.back-link:hover {
  border-color: var(--red);
  color: var(--red);
}

.brand {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.brand-logo {
  flex: none;
  width: 50px;
  height: 50px;
  object-fit: contain;
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

.header-tools {
  display: flex;
  flex: none;
  gap: 6px;
  align-items: center;
  margin-left: auto;
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
    width: auto;
    flex: 1;
  }

  .back-link {
    width: 30px;
    height: 30px;
    justify-content: center;
    padding: 0;
  }

  .back-text {
    display: none;
  }

  .brand-logo {
    width: 40px;
    height: 40px;
  }

  .brand-text h1 {
    font-size: 18px;
  }

  .brand-text p {
    font-size: 11px;
  }

  .header-tools {
    display: none;
  }
}
</style>
