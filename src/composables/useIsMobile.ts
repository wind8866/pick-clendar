import { onBeforeUnmount, onMounted, ref } from 'vue'

const MOBILE_QUERY = '(max-width: 900px)'

/** 响应式判断是否处于移动端布局，与全局样式的断点保持一致 */
export function useIsMobile() {
  const isMobile = ref(
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  )
  let mediaQuery: MediaQueryList | undefined

  function update(): void {
    if (mediaQuery) isMobile.value = mediaQuery.matches
  }

  onMounted(() => {
    mediaQuery = window.matchMedia(MOBILE_QUERY)
    update()
    mediaQuery.addEventListener('change', update)
  })

  onBeforeUnmount(() => {
    mediaQuery?.removeEventListener('change', update)
  })

  return isMobile
}
