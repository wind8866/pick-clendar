<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, ArrowRight, Calendar } from '@element-plus/icons-vue'
import { dateInZone, dayjs, rangeLabel, startOfWeek } from '@/utils/time'
import type { CalendarView, FestivalConfig, FestivalEvent } from '@/types'
import { findFestival } from '@/data/festivals'
import { useSelectionStore } from '@/stores/selection'
import { useIsMobile } from '@/composables/useIsMobile'
import { applyTheme } from '@/utils/theme'
import { hallColor } from '@/utils/halls'
import AppHeader from '@/components/AppHeader.vue'
import WeekCalendar from '@/components/WeekCalendar.vue'
import MonthCalendar from '@/components/MonthCalendar.vue'
import SelectionPanel from '@/components/SelectionPanel.vue'
import DayEventsDialog from '@/components/DayEventsDialog.vue'

const route = useRoute()
const foundConfig = findFestival(String(route.params.festivalId))
if (!foundConfig) {
  throw new Error('未找到对应的日历配置')
}
const config: FestivalConfig = foundConfig

// 在首次渲染前注入主题，避免切到另一个日历的一瞬间沿用上一套配色
if (typeof document !== 'undefined') applyTheme(config.theme)

const store = useSelectionStore()
store.init(config, route.path)

// 路由切换日历由 App.vue 的 router-view key 触发组件重建，因此这里只需按当前配置初始化一次
const isMobile = useIsMobile()
// 多厅/密集排片可在配置里指定默认视图，避免窄屏周视图挤在一起
const view = ref<CalendarView>(
  config.defaultView ?? (isMobile.value ? 'week' : 'month'),
)
const anchor = ref(dateInZone(config.initialDate, config.timeZone).format('YYYY-MM-DD'))
const activeTab = ref<'calendar' | 'selected'>('calendar')
const panelOpen = ref(true)
const isFullscreen = ref(false)
// 周视图跳转信号：点击今天 / 上一周 / 下一周时递增，触发横向日历定位
const weekJumpSeq = ref(0)

/** 同一影院多厅排片时，按影厅筛选；空数组表示全部 */
const halls = computed(() =>
  [
    ...new Set(
      config.events
        .filter((event) => event.kind !== 'header' && event.location)
        .map((event) => event.location as string),
    ),
  ].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')),
)
const selectedHalls = ref<string[]>([])

/** 影厅筛选下拉的厅色标记；未配置厅色时不显示 */
function hallDot(hall: string): string | undefined {
  return hallColor(config, hall)
}

// 月视图纵向展开 / 周视图横向展开，分别记住状态
const monthExpanded = ref(false)
const weekExpanded = ref(false)
const expanded = computed(() =>
  view.value === 'week' ? weekExpanded.value : monthExpanded.value,
)

const expandTip = computed(() => {
  if (view.value === 'week') {
    return weekExpanded.value
      ? '收起，恢复 7 天视图'
      : `展开为 ${isMobile.value ? 2 : 4} 天，每列更宽`
  }
  return monthExpanded.value
    ? '收起，恢复 5 行月视图'
    : '展开，一屏显示当天全部场次'
})

function toggleExpanded(): void {
  if (view.value === 'week') weekExpanded.value = !weekExpanded.value
  else monthExpanded.value = !monthExpanded.value
}

const dayOpen = ref(false)
const dayDate = ref('')

const anchorDate = computed(() => dateInZone(anchor.value, config.timeZone))
const weekStart = computed(() => startOfWeek(anchorDate.value))
const weekEnd = computed(() => weekStart.value.add(6, 'day'))
const monthStart = computed(() => startOfWeek(anchorDate.value))
const monthEnd = computed(() => monthStart.value.add(4, 'week').add(6, 'day'))

/** 周视图当前实际可见的日期范围，由自由横向滚动动态上报 */
const weekRange = ref<{ start: string; end: string } | null>(null)

function onWeekRange(range: { start: string; end: string }): void {
  weekRange.value = range
}

function rangeDay(value: string) {
  return dateInZone(value, config.timeZone)
}

const rangeText = computed(() => {
  const isWeek = view.value === 'week'
  const start = isWeek && weekRange.value
    ? rangeDay(weekRange.value.start)
    : isWeek
      ? weekStart.value
      : monthStart.value
  const end = isWeek && weekRange.value
    ? rangeDay(weekRange.value.end)
    : isWeek
      ? weekEnd.value
      : monthEnd.value
  // 移动端工具栏空间紧张，用紧凑日期格式，避免被截断成「2026年10…」
  if (isMobile.value) return `${start.format('MM/DD')}–${end.format('MM/DD')}`
  return rangeLabel(start, end)
})

function changeView(next: CalendarView): void {
  view.value = next
  if (next === 'month') {
    // 从周视图进入月视图时，以当前周作为月视图的第一行
    anchor.value = weekStart.value.format('YYYY-MM-DD')
  }
}

// 周视图左右按钮按「可见天数」翻页：展开后 4 天/2 天，折叠时仍是 7 天
const weekPageDays = computed(() => (weekExpanded.value ? (isMobile.value ? 2 : 4) : 7))

function shiftPage(delta: number): void {
  anchor.value = anchorDate.value.add(delta * weekPageDays.value, 'day').format('YYYY-MM-DD')
  weekJumpSeq.value += 1
}

function goToday(): void {
  anchor.value = dayjs().tz(config.timeZone).format('YYYY-MM-DD')
  weekJumpSeq.value += 1
}

function openDay(date: string): void {
  dayDate.value = date
  dayOpen.value = true
}

function onDaySelect(event: FestivalEvent): void {
  store.toggle(event.id)
}

function togglePanel(): void {
  panelOpen.value = !panelOpen.value
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await document.documentElement.requestFullscreen?.()
    }
  } catch {
    // 某些环境（如 iOS Safari）不支持全屏，忽略
  }
  syncFullscreen()
}

function syncFullscreen(): void {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

onMounted(() => {
  document.title = `${config.name} · 日程挑选`
  document.addEventListener('fullscreenchange', syncFullscreen)
  syncFullscreen()
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
})
</script>

<template>
  <div class="app-shell">
    <AppHeader
      :config="config"
      :panel-open="panelOpen"
      :is-fullscreen="isFullscreen"
      @toggle-panel="togglePanel"
      @toggle-fullscreen="toggleFullscreen"
    />

    <nav class="mobile-tabs" aria-label="移动端视图切换">
      <button
        type="button"
        :class="{ active: activeTab === 'calendar' }"
        @click="activeTab = 'calendar'"
      >
        排片日历
      </button>
      <button
        type="button"
        :class="{ active: activeTab === 'selected' }"
        @click="activeTab = 'selected'"
      >
        已选
        <span class="tab-count">{{ store.selectedCount }}</span>
      </button>
    </nav>

    <main
      class="app-body"
      :class="{ 'show-selection': activeTab === 'selected', 'panel-closed': !panelOpen }"
    >
      <section class="calendar-pane">
        <div class="calendar-toolbar" :class="{ 'has-halls': halls.length > 1 }">
          <span class="toolbar-range">{{ rangeText }}</span>
          <div class="toolbar-actions">
            <el-select
              v-if="halls.length > 1"
              v-model="selectedHalls"
              multiple
              collapse-tags
              clearable
              size="small"
              class="hall-filter"
              placeholder="全部影厅"
              :max-collapse-tags="1"
              title="按影厅筛选"
              aria-label="按影厅筛选"
            >
              <el-option v-for="hall in halls" :key="hall" :label="hall" :value="hall">
                <span class="hall-option">
                  <span
                    v-if="hallDot(hall)"
                    class="hall-dot"
                    :style="{ background: hallDot(hall) }"
                    aria-hidden="true"
                  />
                  <span>{{ hall }}</span>
                </span>
              </el-option>
            </el-select>

            <el-button
              v-if="view === 'week'"
              circle
              size="small"
              class="week-nav"
              aria-label="上一页"
              @click="shiftPage(-1)"
            >
              <el-icon><ArrowLeft /></el-icon>
            </el-button>

            <el-button size="small" class="today-btn" @click="goToday">
              <el-icon><Calendar /></el-icon>
              今天
            </el-button>
            <el-button
              v-if="view === 'week'"
              circle
              size="small"
              class="week-nav"
              aria-label="下一页"
              @click="shiftPage(1)"
            >
              <el-icon><ArrowRight /></el-icon>
            </el-button>

            <el-tooltip :content="expandTip" placement="bottom" popper-class="header-tip">
              <el-button
                size="small"
                class="expand-btn"
                :class="{ active: expanded }"
                :aria-pressed="expanded"
                @click="toggleExpanded"
              >
                <span class="expand-icon" aria-hidden="true">{{ view === 'week' ? '↔' : '↕' }}</span>
                <span class="expand-text">{{ expanded ? '收起' : '展开' }}</span>
              </el-button>
            </el-tooltip>

            <div class="segmented" role="group" aria-label="视图切换">
              <button
                type="button"
                :class="{ active: view === 'week' }"
                @click="changeView('week')"
              >
                周
              </button>
              <button
                type="button"
                :class="{ active: view === 'month' }"
                @click="changeView('month')"
              >
                月
              </button>
            </div>
          </div>
        </div>

        <WeekCalendar
          v-if="view === 'week'"
          :config="config"
          :anchor="anchor"
          :jump-seq="weekJumpSeq"
          :halls="selectedHalls"
          :expanded="weekExpanded"
          @update:anchor="anchor = $event"
          @range-change="onWeekRange"
        />
        <MonthCalendar
          v-else
          :config="config"
          :anchor="anchor"
          :halls="selectedHalls"
          :expanded="monthExpanded"
          @open-day="openDay"
          @update:anchor="anchor = $event"
        />
      </section>

      <SelectionPanel :config="config" class="selection-pane" />
    </main>

    <DayEventsDialog
      v-model="dayOpen"
      :date="dayDate"
      :config="config"
      :halls="selectedHalls"
      @select="onDaySelect"
    />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  height: 100dvh;
  flex-direction: column;
  overflow: hidden;
}

.app-body {
  display: grid;
  flex: 1;
  min-height: 0;
  grid-template-columns: minmax(0, 3fr) minmax(320px, 1fr);
}

.calendar-pane {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  background: var(--paper-strong);
}

.selection-pane {
  min-height: 0;
}

.calendar-toolbar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--line-soft);
  background: var(--panel-soft);
}

.toolbar-range {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
}

.today-btn {
  color: var(--ink-soft);
}

.today-btn :deep(.el-icon) {
  margin-right: 4px;
}

.hall-filter {
  width: 156px;
}

.hall-filter :deep(.el-select__wrapper) {
  min-height: 24px;
  font-size: 12px;
}

.hall-option {
  display: flex;
  gap: 7px;
  align-items: center;
}

.hall-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.expand-btn {
  color: var(--ink-soft);
}

.expand-btn.active {
  border-color: var(--red);
  background: var(--red-soft);
  color: var(--red);
}

.expand-icon {
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
}

.expand-text {
  margin-left: 4px;
  font-size: 12px;
}

.segmented {
  display: flex;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper-strong);
}

.segmented button {
  min-width: 40px;
  padding: 4px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 13px;
  cursor: pointer;
}

.segmented button.active {
  background: var(--panel-soft);
  box-shadow: 0 1px 4px rgb(80 55 35 / 12%);
  color: var(--red);
  font-weight: 700;
}

.mobile-tabs {
  display: none;
}

@media (min-width: 901px) {
  .app-body.panel-closed {
    grid-template-columns: minmax(0, 1fr);
  }

  .app-body.panel-closed .selection-pane {
    display: none;
  }
}

@media (max-width: 900px) {
  .app-body {
    display: block;
    min-height: 0;
  }

  .calendar-toolbar {
    gap: 6px;
    padding: 6px 10px;
  }

  .toolbar-range {
    flex: 1;
    font-size: 11px;
  }

  /* 多厅日历：日期范围单独一行，给影厅筛选留出宽度 */
  .calendar-toolbar.has-halls {
    flex-wrap: wrap;
    row-gap: 5px;
  }

  .calendar-toolbar.has-halls .toolbar-range {
    flex: 1 0 100%;
  }

  .calendar-toolbar.has-halls .toolbar-actions {
    flex: 1 0 100%;
    justify-content: flex-end;
  }

  .toolbar-actions {
    gap: 6px;
  }

  .week-nav {
    display: none;
  }

  .today-btn {
    padding-right: 8px;
    padding-left: 8px;
  }

  .hall-filter {
    width: 128px;
  }

  .expand-icon {
    font-size: 14px;
  }

  .expand-text {
    display: none;
  }

  .expand-btn {
    padding-right: 7px;
    padding-left: 7px;
  }

  .segmented {
    padding: 2px;
  }

  .segmented button {
    min-width: 36px;
    padding: 3px 8px;
  }

  .calendar-pane,
  .selection-pane {
    height: 100%;
  }

  .app-body:not(.show-selection) .selection-pane {
    display: none;
  }

  .app-body.show-selection .calendar-pane {
    display: none;
  }

  .mobile-tabs {
    display: flex;
    flex: none;
    gap: 6px;
    padding: 7px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--panel-soft);
  }

  .mobile-tabs button {
    display: inline-flex;
    flex: 1;
    gap: 6px;
    align-items: center;
    justify-content: center;
    padding: 7px 10px;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: var(--ink-soft);
    font-size: 13px;
    cursor: pointer;
  }

  .mobile-tabs button.active {
    border-color: var(--line);
    background: var(--paper-strong);
    color: var(--red);
    font-weight: 700;
  }

  .tab-count {
    min-width: 18px;
    padding: 0 5px;
    border-radius: 99px;
    background: var(--red);
    color: #fff8ec;
    font-size: 10px;
    line-height: 16px;
    text-align: center;
  }
}
</style>
