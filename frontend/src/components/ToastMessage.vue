<script setup lang="ts">
defineProps<{
  message: string | null
  type: 'success' | 'error'
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Transition name="toast">
    <div v-if="message" class="toast" :class="`toast--${type}`" role="status">
      <span>{{ message }}</span>
      <button type="button" class="toast__close" aria-label="Cerrar" @click="emit('close')">
        &times;
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: 1.5rem;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  color: #fff;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  max-width: calc(100% - 2rem);
  z-index: 10;
}

.toast--success {
  background: var(--success);
}

.toast--error {
  background: var(--danger);
}

.toast__close {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(0.5rem);
}
</style>
