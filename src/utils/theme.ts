import type { FestivalTheme } from '@/types'

function parseHex(hex: string): [number, number, number] {
  let value = hex.trim().replace('#', '')
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('')
  }
  const num = parseInt(value, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function toHex(r: number, g: number, b: number): string {
  const channel = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/** 按比例混合两个颜色，ratio 为 0 时取 a，1 时取 b */
function mix(a: string, b: string, ratio: number): string {
  const [ar, ag, ab] = parseHex(a)
  const [br, bg, bb] = parseHex(b)
  return toHex(
    ar + (br - ar) * ratio,
    ag + (bg - ag) * ratio,
    ab + (bb - ab) * ratio,
  )
}

function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex)
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

/** 粗略相对亮度，用于给任意主色挑一个可读的前景色 */
function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((value) => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function readableOn(hex: string): string {
  // 亮度低于阈值视为暗底，用浅色字；否则用深色字
  return luminance(hex) > 0.22 ? INK : '#fdf6ec'
}

export const DEFAULT_THEME: FestivalTheme = {
  background: '#E5CEA8',
  primary: '#6A3424',
  secondary: '#9AB9AF',
}

const INK = '#33241d'
const INK_SOFT = '#5f4c3e'
const MUTED = '#8a7a63'
// 冲突 / 失败等危险态固定用红，不跟随主题（绿色主题下不会变绿）
const DANGER = '#a33a2f'
const WHITE = '#ffffff'
const BLACK = '#000000'
// 结构线框用中性色，不跟随主题主色；否则亮色主题会把网格、边框全染成主题色
const LINE_INK = '#6b4a3a'

/** 把主题三色注入根元素 CSS 变量，供全站样式使用 */
export function applyTheme(theme?: FestivalTheme): void {
  const { background, primary, secondary } = theme ?? DEFAULT_THEME
  const root = document.documentElement

  const line = mix(LINE_INK, background, 0.72)
  const lineSoft = mix(LINE_INK, background, 0.86)
  const paperStrong = mix(background, WHITE, 0.72)
  const panelSoft = mix(background, WHITE, 0.42)

  const vars: Record<string, string> = {
    '--paper': background,
    '--paper-strong': paperStrong,
    '--panel-soft': panelSoft,
    '--ink': INK,
    '--ink-soft': INK_SOFT,
    '--muted': MUTED,
    '--line': line,
    '--line-soft': lineSoft,
    '--red': primary,
    '--red-deep': mix(primary, BLACK, 0.18),
    '--red-soft': mix(primary, WHITE, 0.86),
    '--secondary': secondary,
    '--secondary-soft': mix(secondary, WHITE, 0.82),
    // 交互态颜色全部由主题派生，换配色时不会残留上一套颜色
    '--sel-bg': withAlpha(mix(secondary, BLACK, 0.08), 0.72),
    '--sel-line': mix(secondary, BLACK, 0.18),
    '--hover-same-bg': primary,
    '--hover-same-fg': readableOn(primary),
    '--on-primary': readableOn(primary),
    // 提醒 / 悬停底色保持固定语义色，不跟主题主色走
    '--remove-hover-bg': 'rgb(254, 240, 240)',
    '--week-default-bg': '#eae3e0',
    '--highlight': '#fff1b8',
    '--shadow': '0 10px 30px rgb(60 40 28 / 12%)',
    '--el-color-primary': primary,
    '--el-color-primary-light-3': mix(primary, WHITE, 0.3),
    '--el-color-primary-light-5': mix(primary, WHITE, 0.5),
    '--el-color-primary-light-7': mix(primary, WHITE, 0.7),
    '--el-color-primary-light-8': mix(primary, WHITE, 0.8),
    '--el-color-primary-light-9': mix(primary, WHITE, 0.9),
    '--el-color-primary-dark-2': mix(primary, BLACK, 0.2),
    '--el-color-danger': DANGER,
    '--el-color-danger-light-3': mix(DANGER, WHITE, 0.3),
    '--el-color-danger-light-5': mix(DANGER, WHITE, 0.5),
    '--el-color-danger-light-7': mix(DANGER, WHITE, 0.7),
    '--el-color-danger-light-8': mix(DANGER, WHITE, 0.8),
    '--el-color-danger-light-9': mix(DANGER, WHITE, 0.9),
    '--el-color-danger-dark-2': mix(DANGER, BLACK, 0.2),
    '--el-text-color-primary': INK,
    '--el-text-color-regular': INK_SOFT,
    '--el-border-color': line,
    '--el-border-color-light': lineSoft,
    '--el-fill-color-blank': paperStrong,
    '--el-bg-color': paperStrong,
  }

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }

  // 移动端浏览器地址栏颜色跟随主题
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', background)
}
