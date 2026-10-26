<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { dayjs, rangeLabel, startOfWeek, zoned } from '@/utils/time'
import type { CalendarView, FestivalConfig, FestivalEvent } from '@/types'
import { findFestival } from '@/data/festivals'
import { useSelectionStore } from '@/stores/selection'
import AppHeader from '@/components/AppHeader.vue'
import WeekCalendar from '@/components/WeekCalendar.vue'
import MonthCalendar from '@/components/MonthCalendar.vue'
import SelectionPanel from '@/components/SelectionPanel.vue'
import EventDetailDialog from '@/components/EventDetailDialog.vue'
import DayEventsDialog from '@/components/DayEventsDialog.vue'

const route = useRoute()
const foundConfig = findFestival(String(route.params.festivalId))
if (!foundConfig) {
  throw new Error('未找到对应的日历配置')
}
const config: FestivalConfig = foundConfig

const store = useSelectionStore()
store.init(config, route.path)

const view = ref<CalendarView>('month')
const mode = ref<'browse' | 'select'>('browse')
const anchor = ref(dayjs.tz(config.initialDate, config.timeZone).format('YYYY-MM-DD'))
const activeTab = ref<'calendar' | 'selected'>('calendar')

const detailOpen = ref(false)
const detailEvent = ref<FestivalEvent | null>(null)
const dayOpen = ref(false)
const dayDate = ref('')

const anchorDate = computed(() =>
  zoned(`${anchor.value}T12:00:00+08:00`, config.timeZone),
)
const weekStart = computed(() => startOfWeek(anchorDate.value))
const weekEnd = computed(() => weekStart.value.add(6, 'day'))
const monthStart = computed(() => startOfWeek(anchorDate.value))
const monthEnd = computed(() => monthStart.value.add(4, 'week').add(6, 'day'))

const rangeText = computed(() =>
  rangeLabel(
    view.value === 'week' ? weekStart.value : monthStart.value,
    view.value === 'week' ? weekEnd.value : monthEnd.value,
  ),
)

function changeView(next: CalendarView): void {
  view.value = next
  if (next === 'month') {
    // 从周视图进入月视图时，以当前周作为月视图的第一行
    anchor.value = weekStart.value.format('YYYY-MM-DD')
  }
}

function shiftWeek(delta: number): void {
  anchor.value = anchorDate.value.add(delta, 'week').format('YYYY-MM-DD')
}

function goToday(): void {
  anchor.value = dayjs().tz(config.timeZone).format('YYYY-MM-DD')
}

function openDetail(event: FestivalEvent): void {
  detailEvent.value = event
  detailOpen.value = true
}

function openDay(date: string): void {
  dayDate.value = date
  dayOpen.value = true
}

function onDaySelect(event: FestivalEvent): void {
  if (mode.value === 'select') {
    store.toggle(event.id)
  } else {
    dayOpen.value = false
    openDetail(event)
  }
}

onMounted(() => {
  document.title = `${config.name} · 日程挑选`
})
</script>

<template>
  <div class="app-shell">
    <AppHeader
      :config="config"
      :view="view"
      :mode="mode"
      :range-text="rangeText"
      :show-nav="view === 'week'"
      @update:view="changeView"
      @update:mode="mode = $event"
      @prev="shiftWeek(-1)"
      @next="shiftWeek(1)"
      @today="goToday"
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

    <main class="app-body" :class="{ 'show-selection': activeTab === 'selected' }">
      <section class="calendar-pane">
        <WeekCalendar
          v-if="view === 'week'"
          :config="config"
          :anchor="anchor"
          :mode="mode"
          @open-detail="openDetail"
        />
        <MonthCalendar
          v-else
          :config="config"
          :anchor="anchor"
          :mode="mode"
          @open-detail="openDetail"
          @open-day="openDay"
          @update:anchor="anchor = $event"
        />
      </section>

      <SelectionPanel :config="config" class="selection-pane" />
    </main>

    <EventDetailDialog
      v-model="detailOpen"
      :event="detailEvent"
      :config="config"
    />

    <DayEventsDialog
      v-model="dayOpen"
      :date="dayDate"
      :config="config"
      :mode="mode"
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

.mobile-tabs {
  display: none;
}

@media (max-width: 900px) {
  .app-body {
    display: block;
    min-height: 0;
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
