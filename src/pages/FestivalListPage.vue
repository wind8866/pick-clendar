<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { FestivalConfig, FestivalTheme } from '@/types'
import { festivalConfigs } from '@/data/festivals'
import { applyTheme, DEFAULT_THEME } from '@/utils/theme'
import { staticPath } from '@/utils/site'

// 列表页没有具体日历，使用一套中性主题；卡片封面仍用各自日历的主题色
const LIST_THEME: FestivalTheme = {
  background: '#F2ECE2',
  primary: '#6A3424',
  secondary: '#9AB9AF',
}

if (typeof document !== 'undefined') applyTheme(LIST_THEME)

const logoUrl = staticPath('logo.svg')

const cards = computed<FestivalConfig[]>(() =>
  [...festivalConfigs].sort((a, b) => {
    const orderDiff = (a.order ?? 999) - (b.order ?? 999)
    if (orderDiff !== 0) return orderDiff
    const dateDiff = (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    if (dateDiff !== 0) return dateDiff
    return a.id.localeCompare(b.id)
  }),
)

function coverTheme(config: FestivalConfig): FestivalTheme {
  return config.theme ?? DEFAULT_THEME
}

function initialOf(name: string): string {
  return name.trim().slice(0, 1) || '日'
}

function placeOf(config: FestivalConfig): string {
  return [config.city, config.venue].filter(Boolean).join(' · ')
}

onMounted(() => {
  document.title = '排片日历'
})
</script>

<template>
  <div class="list-page">
    <header class="list-header">
      <img class="list-logo" :src="logoUrl" alt="" aria-hidden="true" />
      <div class="list-title">
        <h1>排片日历</h1>
        <p>选择一个影展，查看排片并挑选日程</p>
      </div>
    </header>

    <main class="list-main">
      <p class="list-count">共 {{ cards.length }} 个影展</p>

      <div v-if="cards.length" class="card-grid">
        <router-link
          v-for="config in cards"
          :key="config.id"
          :to="`/pick/${config.id}`"
          class="festival-card"
        >
          <div
            class="card-cover"
            :style="{
              backgroundColor: coverTheme(config).background,
              color: coverTheme(config).primary,
            }"
          >
            <span class="cover-mark" aria-hidden="true">{{ initialOf(config.name) }}</span>
            <span class="cover-tag">排片日历</span>
          </div>

          <div class="card-body">
            <h2>{{ config.name }}</h2>
            <p v-if="placeOf(config)" class="card-place">{{ placeOf(config) }}</p>
            <div class="card-foot">
              <span class="card-updated">
                数据更新 {{ config.updatedAt || '待补' }}
              </span>
              <span class="card-enter">查看排片 →</span>
            </div>
          </div>
        </router-link>
      </div>

      <p v-else class="list-empty">还没有可展示的影展配置。</p>
    </main>
  </div>
</template>

<style scoped>
.list-page {
  height: 100dvh;
  overflow-y: auto;
  background: var(--paper);
  color: var(--ink);
}

.list-header {
  display: flex;
  gap: 16px;
  align-items: center;
  max-width: 1160px;
  margin: 0 auto;
  padding: 44px 24px 26px;
}

.list-logo {
  flex: none;
  width: 52px;
  height: 52px;
  object-fit: contain;
}

.list-title {
  min-width: 0;
}

.list-title h1 {
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.2;
}

.list-title p {
  margin-top: 4px;
  color: var(--muted);
  font-size: 13px;
}

.list-main {
  max-width: 1160px;
  margin: 0 auto;
  padding: 0 24px 56px;
}

.list-count {
  margin-bottom: 14px;
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0.06em;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.festival-card {
  display: flex;
  overflow: hidden;
  flex-direction: column;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--paper-strong);
  color: inherit;
  text-decoration: none;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.festival-card:hover {
  border-color: var(--red);
  box-shadow: var(--shadow);
  transform: translateY(-3px);
}

.festival-card:focus-visible {
  outline: 2px solid var(--red);
  outline-offset: 3px;
}

.card-cover {
  position: relative;
  display: flex;
  overflow: hidden;
  height: 156px;
  flex: none;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px 20px;
  background-image: radial-gradient(
    circle at 86% 16%,
    rgb(255 255 255 / 42%),
    transparent 58%
  );
}

.card-cover::after {
  position: absolute;
  right: -28px;
  bottom: -46px;
  width: 132px;
  height: 132px;
  border: 1px solid currentColor;
  border-radius: 50%;
  content: "";
  opacity: 0.22;
  pointer-events: none;
}

.cover-mark {
  font-family: var(--font-serif);
  font-size: 54px;
  font-weight: 700;
  line-height: 1;
  opacity: 0.9;
}

.cover-tag {
  align-self: flex-start;
  padding: 2px 8px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0.08em;
  opacity: 0.72;
}

.card-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 16px 20px 18px;
}

.card-body h2 {
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.35;
}

.card-place {
  margin-top: 5px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.card-foot {
  display: flex;
  gap: 8px;
  align-items: baseline;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 16px;
}

.card-updated {
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.card-enter {
  flex: none;
  color: var(--red);
  font-size: 11px;
}

.list-empty {
  padding: 60px 0;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
}

@media (max-width: 700px) {
  .list-header {
    gap: 12px;
    padding: 26px 16px 18px;
  }

  .list-logo {
    width: 42px;
    height: 42px;
  }

  .list-title h1 {
    font-size: 25px;
  }

  .list-title p {
    font-size: 12px;
  }

  .list-main {
    padding: 0 16px 40px;
  }

  .card-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
  }

  .card-cover {
    height: 132px;
    padding: 15px 17px;
  }

  .cover-mark {
    font-size: 44px;
  }

  .card-body {
    padding: 14px 17px 15px;
  }

  .card-body h2 {
    font-size: 18px;
  }
}
</style>
