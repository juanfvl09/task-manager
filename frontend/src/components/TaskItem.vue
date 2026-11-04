<script setup lang="ts">
import { computed } from 'vue'
import type { Task } from '@/types/task'

const props = defineProps<{
  task: Task
  busy: boolean
}>()

const emit = defineEmits<{
  toggle: [task: Task]
  edit: [task: Task]
  remove: [task: Task]
}>()

const completed = computed(() => props.task.status === 'COMPLETED')

const createdAt = computed(() =>
  new Date(props.task.createdAt).toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }),
)
</script>

<template>
  <li class="item" :class="{ 'item--done': completed }">
    <label class="item__check">
      <input type="checkbox" :checked="completed" :disabled="busy" @change="emit('toggle', task)" />
    </label>

    <div class="item__body">
      <div class="item__header">
        <h3 class="item__title">{{ task.title }}</h3>
        <span class="status" :class="completed ? 'status--done' : 'status--pending'">
          {{ completed ? 'Completada' : 'Pendiente' }}
        </span>
      </div>
      <p v-if="task.description" class="item__description">{{ task.description }}</p>
      <small class="item__meta">Creada el {{ createdAt }}</small>
    </div>

    <div class="item__actions">
      <button class="button button--small" type="button" :disabled="busy" @click="emit('edit', task)">
        Editar
      </button>
      <button
        class="button button--small button--danger"
        type="button"
        :disabled="busy"
        @click="emit('remove', task)"
      >
        Eliminar
      </button>
    </div>
  </li>
</template>

<style scoped>
.item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem 1rem;
  align-items: start;
  padding: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}

.item--done .item__title {
  text-decoration: line-through;
  color: var(--muted);
}

.item__check input {
  width: 1.15rem;
  height: 1.15rem;
  margin-top: 0.2rem;
  accent-color: var(--primary);
  cursor: pointer;
}

.item__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.item__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.item__title {
  margin: 0;
  font-size: 1rem;
  overflow-wrap: anywhere;
}

.item__description {
  margin: 0;
  color: var(--muted);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.item__meta {
  color: var(--muted);
  font-size: 0.78rem;
}

.item__actions {
  display: flex;
  gap: 0.4rem;
}

.status {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.status--pending {
  background: #fef3c7;
  color: #92400e;
}

.status--done {
  background: #dcfce7;
  color: #166534;
}

@media (max-width: 600px) {
  .item {
    grid-template-columns: auto 1fr;
  }

  .item__actions {
    grid-column: 2;
  }
}
</style>
