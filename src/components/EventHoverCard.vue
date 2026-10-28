<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { FestivalConfig, FestivalEvent } from '@/types'
import EventDetailCard from '@/components/EventDetailCard.vue'

const props = defineProps<{
  event: FestivalEvent
  config: FestivalConfig
  selected: boolean
  x: number
  y: number
}>()

const emit = defineEmits<{
  enter: []
  leave: []
  pick: []
}>()

const cardEl = ref<HTMLElement | null>(null)
const cardHeight = ref(260)

const position = computed(() => {
  const width = 320
  const left = Math.max(8, Math.min(props.x + 16, window.innerWidth - width - 8))
  const top = Math.max(8, Math.min(props.y + 16, window.innerHeight - cardHeight.value - 8))
  return { left: `${left}px`, top: `${top}px` }
})

function measure(): void {
  const height = cardEl.value?.offsetHeight
  if (height) cardHeight.value = height
}

onMounted(() => {
  nextTick(measure)
})

watch(
  () => props.event.id,
  () => {
    nextTick(measure)
  },
)
</script>

<template>
  <Teleport to="body">
    <div
      ref="cardEl"
      class="hover-card"
      :style="position"
      @mouseenter="emit('enter')"
      @mouseleave="emit('leave')"
    >
      <EventDetailCard
        :event="event"
        :config="config"
        :selected="selected"
        @pick="emit('pick')"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.hover-card {
  position: fixed;
  z-index: 3000;
  width: 320px;
  pointer-events: auto;
}
</style>
