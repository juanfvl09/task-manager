<script setup lang="ts">
import type { Task } from '@/types/task'
import TaskItem from './TaskItem.vue'

defineProps<{
  tasks: Task[]
  loading: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  toggle: [task: Task]
  edit: [task: Task]
  remove: [task: Task]
}>()
</script>

<template>
  <section class="list">
    <p v-if="loading" class="list__empty">Cargando tareas...</p>
    <p v-else-if="tasks.length === 0" class="list__empty">
      Todavía no hay tareas. Crea la primera con el formulario.
    </p>
    <ul v-else class="list__items">
      <TaskItem
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :busy="busy"
        @toggle="emit('toggle', $event)"
        @edit="emit('edit', $event)"
        @remove="emit('remove', $event)"
      />
    </ul>
  </section>
</template>

<style scoped>
.list__items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.list__empty {
  margin: 0;
  padding: 2rem 1rem;
  text-align: center;
  color: var(--muted);
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: 0.75rem;
}
</style>
