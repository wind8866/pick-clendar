<script setup lang="ts">
import ScreenshotPoster from '@/components/ScreenshotPoster.vue'
import { useSelectionStore } from '@/stores/selection'
import type { ExportItem, FestivalConfig, FestivalEvent } from '@/types'
import { buildCsv } from '@/utils/csv'
import { downloadBlob, downloadDataUrl, exportFilename } from '@/utils/download'
import { buildIcs } from '@/utils/ics'
import {
  dateTimeLabel,
  formatDuration,
  formatGap,
  hm,
  zoned,
} from '@/utils/time'
import {
  Calendar,
  Camera,
  Check,
  Close,
  Delete,
  Document,
  Edit,
  Link as LinkIcon,
  QuestionFilled,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { toPng } from 'html-to-image'
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  config: FestivalConfig
}>()

const store = useSelectionStore()
const posterWrap = ref<HTMLElement | null>(null)
const capturing = ref(false)

interface SelectionGroup {
  date: string
  label: string
  items: FestivalEvent[]
}

const groups = computed<SelectionGroup[]>(() => {
  const map = new Map<string, FestivalEvent[]>()
  for (const event of store.selectedEvents) {
    const key = store.dateOf(event)
    const bucket = map.get(key)
    if (bucket) bucket.push(event)
    else map.set(key, [event])
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      label: dateTimeLabel(zoned(items[0].start, props.config.timeZone)),
      items,
    }))
})

function startText(event: FestivalEvent): string {
  return hm(zoned(event.start, props.config.timeZone))
}

function endText(event: FestivalEvent): string {
  return hm(zoned(store.endOf(event), props.config.timeZone))
}

function gapInfo(group: SelectionGroup, index: number): { minutes: number; label: string } | null {
  const current = group.items[index]
  const next = group.items[index + 1]
  if (!current || !next) return null
  const currentEnd = zoned(current.start, props.config.timeZone).add(
    current.durationMinutes,
    'minute',
  )
  const minutes = Math.round(zoned(next.start, props.config.timeZone).diff(currentEnd, 'minute', true))
  return { minutes, label: formatGap(minutes) }
}

/* 默认行程时间 */
const defaultTravel = ref(store.defaultTravelTime)
watch(
  () => store.defaultTravelTime,
  (value) => {
    if (defaultTravel.value !== value) defaultTravel.value = value
  },
)
function onDefaultTravelChange(value: number | undefined): void {
  store.setDefaultTravel(value ?? 0)
}

/* 单场路程编辑 */
const travelEditId = ref<string | null>(null)
const travelDraft = ref<number | undefined>(0)
function beginTravel(event: FestivalEvent): void {
  travelEditId.value = event.id
  travelDraft.value = store.travelOf(event)
}
function saveTravel(event: FestivalEvent): void {
  if (travelEditId.value !== event.id) return
  store.setTravel(event.id, travelDraft.value ?? 0)
  travelEditId.value = null
}
function cancelTravel(): void {
  travelEditId.value = null
}

/* 单场描述编辑 */
const descEditId = ref<string | null>(null)
const descDraft = ref('')
function beginDesc(event: FestivalEvent): void {
  descEditId.value = event.id
  descDraft.value = store.descriptionOf(event)
}
function saveDesc(event: FestivalEvent): void {
  if (descEditId.value !== event.id) return
  store.setDescription(event.id, descDraft.value)
  descEditId.value = null
}
function cancelDesc(): void {
  descEditId.value = null
}

/* 新加日程后滚动到对应卡片 */
watch(
  () => store.highlightId,
  async (id) => {
    if (!id) return
    await nextTick()
    document.getElementById(`picked-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  },
)

function exportItems(): ExportItem[] {
  return store.selectedEvents.map((event) => ({
    event,
    end: store.endOf(event),
    description: store.descriptionOf(event),
    travelTime: store.effectiveTravelOf(event),
  }))
}

function downloadIcs(): void {
  if (!store.hasSelection) return
  downloadBlob(
    buildIcs(props.config, exportItems()),
    'text/calendar;charset=utf-8',
    exportFilename(props.config.name, 'ics'),
  )
  ElMessage.success('日历文件已生成')
}

function downloadCsv(): void {
  if (!store.hasSelection) return
  downloadBlob(
    buildCsv(props.config, exportItems()),
    'text/csv;charset=utf-8',
    exportFilename(props.config.name, 'csv'),
  )
  ElMessage.success('CSV 文件已生成')
}

function subscribe(): void {
  const url =
    props.config.subscribeUrl ||
    `${import.meta.env.BASE_URL}subscribe/${props.config.id}.ics`
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function capture(): Promise<void> {
  if (!store.hasSelection) return
  const node = posterWrap.value?.querySelector<HTMLElement>('.poster')
  if (!node) return
  capturing.value = true
  try {
    await document.fonts.ready
    await nextTick()
    const dataUrl = await toPng(node, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#fbf7ee',
    })
    downloadDataUrl(dataUrl, exportFilename(props.config.name, 'png'))
    ElMessage.success('截图已生成')
  } catch (error) {
    console.error(error)
    ElMessage.error('截图生成失败，请重试')
  } finally {
    capturing.value = false
  }
}

async function clearAll(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '将清空已选日程、默认行程时间以及单场的路程和描述自定义内容。',
      '清除已选',
      {
        confirmButtonText: '清除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    store.clearAll()
    ElMessage.success('已清除本地已选内容')
  } catch {
    // 用户取消
  }
}
</script>

<template>
  <aside class="selection-panel">
    <header class="panel-head">
      <div class="panel-title-row">
        <h2>已选日程</h2>
        <span class="selected-count">
          已选 <b>{{ store.selectedCount }}</b> {{ config.itemNoun }}
        </span>
      </div>

      <div class="default-travel">
        <label class="field-label">
          默认行程时间
          <el-tooltip
            content="所有未单独设置路程的日程默认使用这个时长，单位分钟。0 表示不设置行程，导出日历、CSV 和截图时隐藏路程。"
            placement="top"
          >
            <el-icon class="help-icon"><QuestionFilled /></el-icon>
          </el-tooltip>
        </label>
        <div class="default-travel-control">
          <el-input-number
            v-model="defaultTravel"
            :min="0"
            :step="5"
            :precision="0"
            size="small"
            controls-position="right"
            class="travel-input"
            @change="onDefaultTravelChange"
          />
          <span class="unit">分钟</span>
        </div>
      </div>

      <div class="action-grid">
        <el-button
          size="small"
          :loading="capturing"
          :disabled="!store.hasSelection"
          @click="capture"
        >
          <el-icon><Camera /></el-icon>
          列表截图
        </el-button>

        <el-tooltip content="在新窗口打开订阅日历文件" placement="top">
          <span class="btn-wrap">
            <el-button size="small" @click="subscribe">
              <el-icon><LinkIcon /></el-icon>
              订阅日历
            </el-button>
          </span>
        </el-tooltip>

        <el-button size="small" :disabled="!store.hasSelection" @click="downloadIcs">
          <el-icon><Calendar /></el-icon>
          导出日历
        </el-button>

        <el-button size="small" :disabled="!store.hasSelection" @click="downloadCsv">
          <el-icon><Document /></el-icon>
          导出 Excel
        </el-button>

        <el-button
          size="small"
          class="clear-btn"
          type="danger"
          plain
          :disabled="!store.hasSelection"
          @click="clearAll"
        >
          <el-icon><Delete /></el-icon>
          清除已选
        </el-button>
      </div>
    </header>

    <div class="selection-list">
      <div v-if="!groups.length" class="empty">
        <div class="empty-mark" aria-hidden="true">＋</div>
        <p>还没有选择日程</p>
        <span>在左侧日历中点击日程即可加入</span>
      </div>

      <section v-for="group in groups" :key="group.date" class="group">
        <header class="group-head">{{ group.label }}</header>

        <div class="group-body">
          <template v-for="(item, index) in group.items" :key="item.id">
            <article
              :id="`picked-${item.id}`"
              class="pick-card"
              :class="{
                highlight: store.highlightId === item.id,
                'hover-same': store.isHoverSibling(item),
              }"
              @mouseenter="store.setHoverPicked(item.id)"
              @mouseleave="store.clearHoverPicked()"
            >
              <div class="card-head">
                <a
                  v-if="item.url"
                  class="card-title-link"
                  :href="item.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  :title="item.url"
                >
                  <h3>{{ store.displayTitle(item) }}</h3>
                </a>
                <h3 v-else>{{ store.displayTitle(item) }}</h3>
                <span v-if="item.postScreening" class="card-tag">映后交流</span>
              </div>

              <p class="card-time">
                {{ startText(item) }} – {{ endText(item) }}
                <span class="card-duration">· {{ formatDuration(item.durationMinutes) }}</span>
              </p>

              <div v-if="!store.isAdjacentToPrev(item)" class="card-field">
                <span class="field-label inline-label">
                  路程
                  <el-tooltip
                    content="仅修改当前日程的路程，单位分钟；0 表示不设置。"
                    placement="top"
                  >
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                  ：
                </span>

                <template v-if="travelEditId !== item.id">
                  <span class="field-value" :class="{ muted: store.travelOf(item) === 0 }">
                    {{ store.travelOf(item) === 0 ? '未设置' : `${store.travelOf(item)} 分钟` }}
                  </span>
                  <el-button
                    text
                    circle
                    size="small"
                    class="pencil"
                    aria-label="编辑路程"
                    @click="beginTravel(item)"
                  >
                    <el-icon><Edit /></el-icon>
                  </el-button>
                </template>

                <div v-else class="inline-edit">
                  <el-input-number
                    v-model="travelDraft"
                    :min="0"
                    :step="5"
                    :precision="0"
                    size="small"
                    controls-position="right"
                    class="inline-number"
                    @keydown.enter.prevent="saveTravel(item)"
                    @keydown.esc="cancelTravel"
                  />
                  <span class="unit">分钟</span>
                  <el-button text circle size="small" aria-label="保存" @click="saveTravel(item)">
                    <el-icon><Check /></el-icon>
                  </el-button>
                  <el-button text circle size="small" aria-label="取消" @click="cancelTravel">
                    <el-icon><Close /></el-icon>
                  </el-button>
                </div>
              </div>

              <div class="card-desc">
                <span class="field-label inline-label">
                  描述
                  <el-tooltip
                    content="仅修改当前日程在已选列表、截图和导出文件中的描述，不影响原始日历数据。"
                    placement="top"
                  >
                    <el-icon class="help-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                  ：
                </span>

                <template v-if="descEditId !== item.id">
                  <p class="desc-text">{{ store.descriptionOf(item) }}</p>
                  <el-button
                    text
                    circle
                    size="small"
                    class="pencil"
                    aria-label="编辑描述"
                    @click="beginDesc(item)"
                  >
                    <el-icon><Edit /></el-icon>
                  </el-button>
                </template>

                <div v-else class="desc-edit">
                  <el-input
                    v-model="descDraft"
                    type="textarea"
                    :rows="2"
                    size="small"
                    resize="none"
                    @keydown.esc="cancelDesc"
                  />
                  <div class="desc-edit-actions">
                    <el-button size="small" type="primary" @click="saveDesc(item)">保存</el-button>
                    <el-button size="small" @click="cancelDesc">取消</el-button>
                  </div>
                </div>
              </div>

              <div class="card-foot">
                <el-button
                  text
                  size="small"
                  class="remove-btn"
                  @click="store.discard(item.id)"
                >
                  <el-icon><Delete /></el-icon>
                  移除日程
                </el-button>
              </div>
            </article>

            <div
              v-if="gapInfo(group, index)"
              class="gap"
              :class="{ conflict: (gapInfo(group, index)?.minutes ?? 0) < 0 }"
            >
              <span class="gap-label">{{ gapInfo(group, index)?.label }}</span>
            </div>
          </template>
        </div>
      </section>
    </div>

    <div ref="posterWrap" class="poster-holder">
      <ScreenshotPoster :config="config" />
    </div>
  </aside>
</template>

<style scoped>
.selection-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  border-left: 1px solid var(--line);
  background: var(--panel-soft);
}

.panel-head {
  flex: none;
  padding: 14px 14px 12px;
  border-bottom: 1px solid var(--line);
  background:
    radial-gradient(circle at 100% 0%, rgb(200 161 90 / 12%), transparent 45%),
    var(--panel-soft);
}

.panel-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.panel-title-row h2 {
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 21px;
  font-weight: 700;
}

.selected-count {
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.selected-count b {
  color: var(--red);
  font-family: var(--font-serif);
  font-size: 17px;
}

.default-travel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 9px;
}

.field-label {
  display: inline-flex;
  align-items: center;
  color: var(--ink-soft);
  font-size: 12px;
  line-height: 1.4;
}

.default-travel-control {
  display: flex;
  align-items: center;
  gap: 5px;
}

.travel-input {
  width: 92px;
}

.unit {
  color: var(--muted);
  font-size: 11px;
  white-space: nowrap;
}

.action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 11px;
}

.action-grid :deep(.el-button) {
  width: 100%;
  margin-left: 0;
  font-size: 12px;
}

.action-grid :deep(.el-button + .el-button) {
  margin-left: 0;
}

.btn-wrap {
  display: block;
  width: 100%;
}

.btn-wrap :deep(.el-button) {
  width: 100%;
}

.clear-btn {
  grid-column: span 2;
}

.selection-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px 24px;
  background: var(--panel-soft);
  scroll-behavior: smooth;
}

.empty {
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  padding: 30px 16px;
  color: var(--muted);
  text-align: center;
}

.empty-mark {
  display: grid;
  width: 46px;
  height: 46px;
  margin-bottom: 6px;
  border: 1px dashed var(--line);
  border-radius: 50%;
  color: var(--red);
  font-family: var(--font-serif);
  font-size: 22px;
  place-items: center;
}

.empty p {
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 16px;
}

.empty span {
  font-size: 12px;
}

.group {
  margin-bottom: 32px;
}

.group:last-child {
  margin-bottom: 0;
}

.group-head {
  position: sticky;
  top: 0;
  z-index: 3;
  margin: 0 -12px;
  padding: 12px 16px 7px;
  background: linear-gradient(var(--panel-soft) 72%, rgb(247 241 230 / 0%));
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
  font-variant-numeric: tabular-nums;
}

.group-body {
  padding-bottom: 4px;
}

.pick-card {
  padding: 10px 11px 7px;
  border: 1px solid var(--line-soft);
  border-radius: 10px;
  background: var(--paper-strong);
  box-shadow: 0 2px 7px rgb(89 60 38 / 4%);
  transition: background-color 0.5s ease, border-color 0.2s ease;
}

.pick-card.highlight {
  animation: card-flash 1.9s ease;
  border-color: var(--gold);
}

.pick-card.hover-same {
  background: var(--secondary-soft);
}

@keyframes card-flash {
  0%,
  55% {
    background: var(--highlight);
  }

  100% {
    background: var(--paper-strong);
  }
}

.card-head {
  display: flex;
  gap: 7px;
  align-items: flex-start;
  justify-content: space-between;
}

.card-head h3 {
  color: var(--ink);
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
}

.card-title-link {
  flex: 1;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.card-title-link h3:hover {
  color: var(--red);
  text-decoration: underline;
}

.card-tag {
  flex: none;
  padding: 1px 5px;
  border: 1px solid rgb(140 47 47 / 20%);
  border-radius: 3px;
  color: var(--red);
  font-size: 9px;
  line-height: 1.5;
}

.card-time {
  margin-top: 3px;
  color: var(--red);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.card-duration {
  color: var(--muted);
  font-size: 11px;
}

.card-field {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 25px;
  margin-top: 4px;
}

.inline-label {
  flex: none;
}

.field-value {
  color: var(--ink);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.field-value.muted {
  color: var(--muted);
}

.pencil {
  color: var(--muted);
}

.pencil:hover {
  color: var(--red);
}

.inline-edit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px;
}

.inline-number {
  width: 84px;
}

.card-desc {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-top: 2px;
}

.card-desc .inline-label {
  margin-top: 2px;
}

.desc-text {
  flex: 1;
  padding-top: 1px;
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 12.5px;
  line-height: 1.6;
  word-break: break-word;
}

.desc-edit {
  flex: 1;
  min-width: 0;
}

.desc-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 5px;
}

.card-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: 3px;
  padding-top: 3px;
  border-top: 1px dashed var(--line-soft);
}

.remove-btn {
  color: var(--red);
  font-size: 11px;
}

.remove-btn:hover {
  color: var(--red-deep);
  background: var(--remove-hover-bg) !important;
}

.gap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
}

.gap::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  border-left: 1px dashed #c8b79b;
  content: "";
}

.gap-label {
  position: relative;
  padding: 1px 7px;
  background: var(--panel-soft);
  color: var(--muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.gap.conflict .gap-label {
  color: var(--red);
  font-weight: 700;
}

.poster-holder {
  position: fixed;
  top: 0;
  left: -10000px;
  z-index: -1;
  pointer-events: none;
}

@media (max-width: 900px) {
  .selection-panel {
    border-left: 0;
  }

  .panel-head {
    padding: 10px 12px 10px;
  }

  .panel-title-row h2 {
    font-size: 19px;
  }

  .action-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .clear-btn {
    grid-column: span 3;
  }

  .selection-list {
    padding: 0 10px 20px;
  }
}
</style>
