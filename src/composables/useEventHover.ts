import { ref } from 'vue'
import type { FestivalEvent } from '@/types'

/** 鼠标移出日程到详情卡片消失之间的宽限时间（毫秒） */
export const HOVER_GRACE_MS = 260

/**
 * 管理「日程悬停详情卡片」的展示生命周期：
 * 移出日程后延迟消失，足够鼠标移入卡片；卡片内不再消失，移出卡片后再消失。
 */
export function useEventHover() {
  const event = ref<FestivalEvent | null>(null)
  const x = ref(0)
  const y = ref(0)
  let timer: ReturnType<typeof setTimeout> | undefined
  let cardActive = false

  function show(next: FestivalEvent, nx: number, ny: number): void {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    event.value = next
    x.value = nx
    y.value = ny
  }

  function scheduleHide(): void {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      if (cardActive) return
      event.value = null
    }, HOVER_GRACE_MS)
  }

  function enterCard(): void {
    cardActive = true
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function leaveCard(): void {
    cardActive = false
    scheduleHide()
  }

  function hide(): void {
    cardActive = false
    if (timer) clearTimeout(timer)
    timer = undefined
    event.value = null
  }

  return { event, x, y, show, scheduleHide, enterCard, leaveCard, hide }
}
