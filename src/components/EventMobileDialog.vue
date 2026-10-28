<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import type { FestivalConfig, FestivalEvent } from '@/types'
import EventDetailCard from '@/components/EventDetailCard.vue'

defineProps<{
  event: FestivalEvent
  config: FestivalConfig
  selected: boolean
}>()

const emit = defineEmits<{
  pick: []
  close: []
}>()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="event-dialog-backdrop" @click.self="emit('close')">
      <div
        class="event-dialog-panel"
        role="dialog"
        aria-modal="true"
        :aria-label="`${event.titlePrefix ?? ''}${event.title}`"
      >
        <EventDetailCard
          :event="event"
          :config="config"
          :selected="selected"
          show-close
          @pick="emit('pick')"
          @close="emit('close')"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.event-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3200;
  display: grid;
  padding: 18px;
  background: rgb(51 36 29 / 0.42);
  overscroll-behavior: contain;
  place-items: center;
  animation: dialog-fade 0.16s ease;
}

.event-dialog-panel {
  width: min(360px, 100%);
  max-height: min(86dvh, 680px);
  overflow-y: auto;
  border-radius: 13px;
  animation: dialog-pop 0.18s ease;
}

@keyframes dialog-fade {
  from {
    opacity: 0;
  }
}

@keyframes dialog-pop {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}
</style>
