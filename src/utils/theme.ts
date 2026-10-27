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

export const DEFAULT_THEME: FestivalTheme = {
  background: '#E5CEA8',
  primary: '#6A3424',
  secondary: '#9AB9AF',
}

const INK = '#33241d'
const INK_SOFT = '#5f4c3e'
const MUTED = '#8a7a63'
const WHITE = '#ffffff'
const BLACK = '#000000'

/** 把主题三色注入根元素 CSS 变量，供全站样式使用 */
export function applyTheme(theme?: FestivalTheme): void {
  const { background, primary, secondary } = theme ?? DEFAULT_THEME
  const root = document.documentElement

  const line = mix(primary, background, 0.5)
  const lineSoft = mix(primary, background, 0.72)
  const paperStrong = mix(background, WHITE, 0.72)
  const panelSoft = mix(background, WHITE, 0.42)

  const vars: Record<string, string> = {
    '--paper': background,
    '--paper-strong': paperStrong,
    '--panel': mix(background, primary, 0.05),
    '--panel-soft': panelSoft,
    '--ink': INK,
    '--ink-soft': INK_SOFT,
    '--muted': MUTED,
    '--line': line,
    '--line-soft': lineSoft,
    '--red': primary,
    '--red-deep': mix(primary, BLACK, 0.18),
    '--red-soft': mix(primary, WHITE, 0.86),
    '--gold': mix(primary, '#e7c877', 0.35),
    '--gold-soft': mix(primary, '#f6e9c8', 0.55),
    '--secondary': secondary,
    '--secondary-soft': mix(secondary, WHITE, 0.82),
    '--secondary-deep': mix(secondary, BLACK, 0.18),
    '--highlight': '#fff1b8',
    '--shadow': '0 10px 30px rgb(60 40 28 / 12%)',
    '--el-color-primary': primary,
    '--el-color-primary-light-3': mix(primary, WHITE, 0.3),
    '--el-color-primary-light-5': mix(primary, WHITE, 0.5),
    '--el-color-primary-light-7': mix(primary, WHITE, 0.7),
    '--el-color-primary-light-8': mix(primary, WHITE, 0.8),
    '--el-color-primary-light-9': mix(primary, WHITE, 0.9),
    '--el-color-primary-dark-2': mix(primary, BLACK, 0.2),
    '--el-color-danger': mix(primary, '#a33a2f', 0.2),
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
}
