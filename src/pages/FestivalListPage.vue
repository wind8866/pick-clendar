<script setup lang="ts">
import { festivalConfigs } from '@/data/festivals'
import type {
  FestivalConfig,
  FestivalCoverStyle,
  FestivalTheme,
} from '@/types'
import { staticPath } from '@/utils/site'
import { applyTheme, DEFAULT_THEME } from '@/utils/theme'
import { computed, onMounted } from 'vue'

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

function coverText(config: FestivalConfig): string {
  return (config.cover?.text?.trim() || config.name).trim()
}

function coverStyle(config: FestivalConfig): FestivalCoverStyle {
  return config.cover?.style ?? 'plain'
}

function hasEyes(config: FestivalConfig): boolean {
  return config.cover?.motif === 'eyes'
}

// 每张卡片的眼睛和它们在封面里的相对位置只量一次；
// 没有眼睛彩蛋的卡片直接返回 null，连 rAF 都不用排
interface EyeRig {
  cover: HTMLElement
  eyes: { el: HTMLElement; x: number; y: number }[]
}

const rigCache = new WeakMap<HTMLElement, EyeRig | null>()

function rigOf(card: HTMLElement): EyeRig | null {
  if (rigCache.has(card)) return rigCache.get(card) ?? null
  const cover = card.querySelector<HTMLElement>('.card-cover')
  const eyes = cover ? [...cover.querySelectorAll<HTMLElement>('.eye')] : []
  const rig =
    cover && eyes.length
      ? {
          cover,
          // offsetLeft / offsetTop 是布局位置，不受“飞入”动画的 transform 影响，
          // 所以鼠标刚进来、眼睛还在飞的时候也能算出最终落点
          eyes: eyes.map((el) => ({
            el,
            x: el.offsetLeft + el.offsetWidth / 2,
            y: el.offsetTop + el.offsetHeight / 2,
          })),
        }
      : null
  rigCache.set(card, rig)
  return rig
}

interface LookPoint {
  card: HTMLElement
  x: number
  y: number
}

let lookFrame = 0
let lookPoint: LookPoint | null = null

/**
 * 眼珠跟随指针：每只眼睛按自己的圆心算到指针的方向，
 * 换算成 [-1, 1] 的系数写进 --look-x / --look-y，实际位移距离由 CSS 的 --eye-travel 决定。
 * 各算各的而不是共用方向，指针落在两眼之间时两只眼珠会向内靠，正好是斗鸡眼的 ◑_◐。
 *
 * 性能：pointermove 一帧能来好几次，直接在里面读 getBoundingClientRect 会反复触发布局刷新，
 * 鼠标划得快时就是肉眼可见的卡顿。这里只记录最新坐标，真正的计算合到一帧里做一次，
 * 而且每帧只读一次封面的位置（眼睛的相对位置是缓存的），坐标没变就不写样式。
 */
function trackPupils(event: PointerEvent) {
  if (event.pointerType === 'touch') return
  const card = event.currentTarget as HTMLElement
  if (!rigOf(card)) return
  lookPoint = { card, x: event.clientX, y: event.clientY }
  if (!lookFrame) lookFrame = requestAnimationFrame(applyLook)
}

function applyLook() {
  lookFrame = 0
  const point = lookPoint
  if (!point) return
  const rig = rigOf(point.card)
  if (!rig) return
  const box = rig.cover.getBoundingClientRect()
  rig.eyes.forEach(({ el, x, y }) => {
    const dx = point.x - (box.left + x)
    const dy = point.y - (box.top + y)
    const dist = Math.hypot(dx, dy)
    if (!dist) return
    // 指针越远看得越“满”，贴近时收一点，眼珠才不会一直顶在圆环上
    const reach = Math.min(1, 0.4 + dist / 150)
    const lookX = ((dx / dist) * reach).toFixed(3)
    const lookY = ((dy / dist) * reach).toFixed(3)
    if (
      el.style.getPropertyValue('--look-x') === lookX &&
      el.style.getPropertyValue('--look-y') === lookY
    ) {
      return
    }
    el.style.setProperty('--look-x', lookX)
    el.style.setProperty('--look-y', lookY)
  })
}

/** 每次进入卡片都重新量一次，断点切换、字号变化后眼睛位置变了也能跟上 */
function prepareEyes(event: PointerEvent) {
  const card = event.currentTarget as HTMLElement
  rigCache.delete(card)
  card.classList.add('is-tracking')
}

/** 指针离开卡片：丢掉没跑完的那一帧，清掉行内变量，眼珠带缓动回到 CSS 里的默认朝向 */
function resetPupils(event: PointerEvent) {
  if (lookFrame) {
    cancelAnimationFrame(lookFrame)
    lookFrame = 0
  }
  lookPoint = null
  const card = event.currentTarget as HTMLElement | null
  if (!card) return
  // 先摘掉 is-tracking，让下面这次属性变化走 .3s 的过渡
  card.classList.remove('is-tracking')
  rigOf(card)?.eyes.forEach(({ el }) => {
    el.style.removeProperty('--look-x')
    el.style.removeProperty('--look-y')
  })
}

// 错落样式的手写参数：基线起伏 + 明显旋转 / 缩放，
// 从左到右形成一条可顺序阅读的“波浪动线”，不依赖随机数，刷新后保持稳定
const SCATTER_PATTERN = [
  { dy: '12px', rot: '-16deg', scale: '1.2' },
  { dy: '-14px', rot: '13deg', scale: '0.88' },
  { dy: '9px', rot: '-10deg', scale: '1.14' },
  { dy: '-11px', rot: '17deg', scale: '0.84' },
]

// 呼吸样式：每个字用不同的周期与相位，避免“排队变透明”的规律感
const BREATH_PATTERN = [
  { delay: '0s', duration: '17s' },
  { delay: '-7.3s', duration: '21s' },
  { delay: '-12.6s', duration: '19s' },
  { delay: '-3.8s', duration: '23s' },
  { delay: '-15.2s', duration: '18s' },
]

// 呼吸样式点缀的三两颗“星星”，位置按百分比相对封面短名
const BREATH_STARS = [
  { key: 'star-a', top: '-8px', left: '6%', delay: '0s', size: '3.5px' },
  { key: 'star-b', top: '-11px', left: '48%', delay: '-2.6s', size: '2.5px' },
  { key: 'star-c', top: '-4px', left: '92%', delay: '-5.1s', size: '3px' },
]

interface CoverChar {
  key: string
  char: string
  vars: Record<string, string>
}

interface CoverStar {
  key: string
  vars: Record<string, string>
}

function coverChars(config: FestivalConfig): CoverChar[] {
  const style = coverStyle(config)
  return [...coverText(config)].map((char, index) => {
    const vars: Record<string, string> = { '--i': String(index) }
    if (style === 'scatter') {
      const item = SCATTER_PATTERN[index % SCATTER_PATTERN.length]
      vars['--dy'] = item.dy
      vars['--rot'] = item.rot
      vars['--scale'] = item.scale
    }
    if (style === 'breath') {
      const item = BREATH_PATTERN[index % BREATH_PATTERN.length]
      vars['--delay'] = item.delay
      vars['--dur'] = item.duration
    }
    return { key: `${char}-${index}`, char, vars }
  })
}

function coverStars(config: FestivalConfig): CoverStar[] {
  if (coverStyle(config) !== 'breath') return []
  return BREATH_STARS.map((star) => ({
    key: star.key,
    vars: {
      '--delay': star.delay,
      '--size': star.size,
      '--top': star.top,
      '--left': star.left,
    },
  }))
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
      <router-link to="/pick" class="list-logo-link" aria-label="返回首页">
        <img class="list-logo" :src="logoUrl" alt="" aria-hidden="true" />
      </router-link>
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
          @pointerenter="prepareEyes"
          @pointermove="trackPupils"
          @pointerleave="resetPupils"
        >
          <div
            class="card-cover"
            :class="{ 'has-eyes': hasEyes(config) }"
            :style="{
              backgroundColor: coverTheme(config).background,
              color: coverTheme(config).primary,
            }"
          >
            <span v-if="hasEyes(config)" class="cover-facade" aria-hidden="true">
              <span class="cover-ribs" />
              <span class="eye eye-left"><span class="eye-dot" /></span>
              <span class="eye eye-right"><span class="eye-dot" /></span>
            </span>
            <span
              class="cover-mark"
              :class="[`style-${coverStyle(config)}`, { long: coverChars(config).length > 4 }]"
              aria-hidden="true"
            >
              <span
                v-for="item in coverChars(config)"
                :key="item.key"
                class="cover-char"
                :style="item.vars"
              >
                <span class="glyph">{{ item.char }}</span>
                <span
                  v-if="coverStyle(config) === 'ripple'"
                  class="glyph-ghost"
                  aria-hidden="true"
                >{{ item.char }}</span>
              </span>
              <span
                v-for="star in coverStars(config)"
                :key="star.key"
                class="cover-star"
                :style="star.vars"
                aria-hidden="true"
              />
            </span>
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

.list-logo-link {
  display: flex;
  flex: none;
  border-radius: 10px;
  transition: opacity 0.2s ease;
}

.list-logo-link:hover {
  opacity: 0.78;
}

.list-logo-link:focus-visible {
  outline: 2px solid var(--red);
  outline-offset: 3px;
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

/* 风格万相：悬停时两只“眼睛”飞到上中部，背景浮出很浅的竖纹 */
.card-cover.has-eyes::after {
  display: none;
}

.cover-facade {
  --eye: 44px;
  --eye-top: 18px;
  --eye-gap: 12px;
  --eye-inset: 8px;
  /* 眼珠直径取眼睛的 0.3，剩下的大半圈就是它能滑动的范围：
     (眼睛 - 左右各 2px 描边 - 眼珠) / 2，滑到最远时眼珠刚好贴住内圈 */
  --pupil: calc(var(--eye) * 0.3);
  --eye-travel: calc((var(--eye) - 4px - var(--pupil)) / 2);
  /* 没有指针时的朝向：偏左下，对应原来 7~8 点钟那个小圆点 */
  --idle-x: -0.5;
  --idle-y: 0.55;
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.cover-ribs {
  position: absolute;
  top: -8%;
  left: 0;
  width: 100%;
  height: 72%;
  background-image: repeating-linear-gradient(
    90deg,
    currentColor 0 1px,
    transparent 1px 10px
  );
  opacity: 0;
  transition: opacity 0.6s ease;
  -webkit-mask-image: linear-gradient(to right, transparent, #000 16%, #000 84%, transparent);
  mask-image: linear-gradient(to right, transparent, #000 16%, #000 84%, transparent);
}

.festival-card:hover .cover-ribs,
.festival-card:focus-visible .cover-ribs {
  opacity: 0.07;
}

.eye {
  position: absolute;
  top: var(--eye-top);
  width: var(--eye);
  height: var(--eye);
  border: 2px solid currentColor;
  border-radius: 50%;
  opacity: 0.6;
  transition: transform 0.9s cubic-bezier(0.22, 0.68, 0.24, 1), opacity 0.55s ease;
}

/* 左上角“看不见的地方”起飞，掠过标题上方落到眼睛位置 */
.eye-left {
  right: calc(var(--eye-inset) + var(--eye) + var(--eye-gap));
  opacity: 0;
  transform: translate(-560%, -130%) scale(0.8);
}

/* 右下角那只半圆，先停在这里 */
.eye-right {
  right: var(--eye-inset);
  transform: translate(75%, 190%);
}

.festival-card:hover .eye-left,
.festival-card:focus-visible .eye-left {
  opacity: 0.62;
  transform: none;
}

.festival-card:hover .eye-right,
.festival-card:focus-visible .eye-right {
  transform: none;
}

/* 眼珠：小圆点，随指针在圈内滑动，滑到最远处贴住内圈。
   只有“回到默认朝向”才用过渡；跟随中直接跟手，见下面的 .is-tracking */
.eye-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--pupil);
  height: var(--pupil);
  border-radius: 50%;
  background: currentColor;
  transform: translate(
    calc(-50% + (var(--look-x, var(--idle-x)) * var(--eye-travel))),
    calc(-50% + (var(--look-y, var(--idle-y)) * var(--eye-travel)))
  );
  transition: transform 0.3s cubic-bezier(0.22, 0.68, 0.24, 1);
}

/* 跟随中不要过渡：每帧都在改目标，缓动会被反复打断、眼珠永远慢半拍，看着就像卡顿 */
.festival-card.is-tracking .eye-dot {
  transition: none;
}

/* 单独提为合成层：眼珠只改 transform，移动时不会连带重绘整张卡片（卡片 hover 本身也在合成层里） */
.festival-card:hover .eye-dot,
.festival-card:focus-visible .eye-dot {
  will-change: transform;
}

.cover-mark {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  gap: 0.04em;
  font-family: var(--font-serif);
  font-size: 54px;
  font-weight: 700;
  line-height: 1;
  opacity: 0.92;
}

/* 5 字短名收一档字号，避免贴边 */
.cover-mark.long {
  font-size: 46px;
}

.cover-char {
  position: relative;
  display: inline-block;
}

.glyph {
  position: relative;
  z-index: 1;
  display: inline-block;
}

/* 错落：基线起伏 + 明显旋转缩放，从左到右形成可顺序阅读的波浪动线 */
.style-scatter {
  gap: 0.1em;
}

.style-scatter .cover-char {
  transform: translateY(var(--dy, 0)) rotate(var(--rot, 0deg)) scale(var(--scale, 1));
  transform-origin: 50% 80%;
}

/* 呼吸：每字不同周期 / 相位，明暗差拉大，慢速闪烁像星星 */
.style-breath .cover-char {
  animation: cover-breath var(--dur, 19s) ease-in-out infinite;
  animation-delay: var(--delay, 0s);
}

@keyframes cover-breath {
  0%,
  100% {
    opacity: 0.3;
  }

  42% {
    opacity: 1;
  }

  58% {
    opacity: 0.55;
  }
}

/* 呼吸样式点缀的星星 */
.cover-star {
  position: absolute;
  top: var(--top, 0);
  left: var(--left, 0);
  z-index: 2;
  width: var(--size, 2px);
  height: var(--size, 2px);
  border-radius: 50%;
  background: currentColor;
  opacity: 0.2;
  pointer-events: none;
  animation: cover-twinkle 6.8s ease-in-out infinite;
  animation-delay: var(--delay, 0s);
}

@keyframes cover-twinkle {
  0%,
  100% {
    opacity: 0.12;
    transform: scale(0.7);
  }

  50% {
    opacity: 0.95;
    transform: scale(1.25);
  }
}

/* 江南：字在水面轻轻浮动；倒影沿文字横向中线翻转 180°，原地叠一层镜像 */
.style-ripple .cover-char {
  animation: cover-float 7s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.5s);
}

@keyframes cover-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-4px);
  }
}

.style-ripple .glyph {
  z-index: 1;
}

.style-ripple .glyph-ghost {
  position: absolute;
  top: 105%;
  left: 0;
  z-index: 0;
  color: currentColor;
  opacity: 0.22;
  pointer-events: none;
  filter: blur(0.4px);
  /* 以文字横向中线为轴向前翻 180°，倒影与正文重合 */
  transform: rotateX(180deg);
  transform-origin: center;
}

.cover-tag {
  position: relative;
  z-index: 1;
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

/* 尊重系统的减少动态效果设置 */
@media (prefers-reduced-motion: reduce) {
  .style-breath .cover-char,
  .style-ripple .cover-char,
  .style-ripple .glyph-ghost,
  .cover-star {
    animation: none;
  }

  .cover-ribs,
  .eye,
  .eye-dot {
    transition: none;
  }
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

  .cover-facade {
    --eye: 42px;
    --eye-top: 12px;
    --eye-gap: 10px;
    --eye-inset: 10px;
  }

  .cover-mark.long {
    font-size: 38px;
  }

  .card-body {
    padding: 14px 17px 15px;
  }

  .card-body h2 {
    font-size: 18px;
  }
}
</style>
