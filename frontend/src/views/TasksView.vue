<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import InstanceBadge from '@/components/InstanceBadge.vue'
import TaskForm from '@/components/TaskForm.vue'
import TaskList from '@/components/TaskList.vue'
import ToastMessage from '@/components/ToastMessage.vue'
import { ApiError } from '@/services/http'
import {
  createTask,
  deleteTask,
  getTasks,
  updateTask,
  updateTaskStatus,
} from '@/services/tasks.service'
import type { Task, TaskInput } from '@/types/task'

const tasks = ref<Task[]>([])
const loading = ref(true)
const busy = ref(false)
const editing = ref<Task | null>(null)

const toast = ref<{ message: string; type: 'success' | 'error' } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined

const pendingCount = computed(() => tasks.value.filter((t) => t.status === 'PENDING').length)
const completedCount = computed(() => tasks.value.length - pendingCount.value)

function notify(message: string, type: 'success' | 'error' = 'success') {
  clearTimeout(toastTimer)
  toast.value = { message, type }
  toastTimer = setTimeout(() => (toast.value = null), 4000)
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return 'No fue posible comunicarse con el servidor'
}

async function run(action: () => Promise<void>, successMessage: string) {
  busy.value = true
  try {
    await action()
    notify(successMessage)
  } catch (error) {
    notify(describeError(error), 'error')
  } finally {
    busy.value = false
  }
}

async function loadTasks() {
  loading.value = true
  try {
    tasks.value = await getTasks()
  } catch (error) {
    notify(describeError(error), 'error')
  } finally {
    loading.value = false
  }
}

function onSubmit(input: TaskInput) {
  if (editing.value) {
    const id = editing.value.id
    void run(async () => {
      const updated = await updateTask(id, input)
      tasks.value = tasks.value.map((t) => (t.id === id ? updated : t))
      editing.value = null
    }, 'Tarea actualizada')
    return
  }

  void run(async () => {
    const created = await createTask(input)
    tasks.value = [created, ...tasks.value]
  }, 'Tarea creada')
}

function onToggle(task: Task) {
  const status = task.status === 'PENDING' ? 'COMPLETED' : 'PENDING'
  void run(async () => {
    const updated = await updateTaskStatus(task.id, status)
    tasks.value = tasks.value.map((t) => (t.id === task.id ? updated : t))
  }, status === 'COMPLETED' ? 'Tarea completada' : 'Tarea marcada como pendiente')
}

function onRemove(task: Task) {
  void run(async () => {
    await deleteTask(task.id)
    tasks.value = tasks.value.filter((t) => t.id !== task.id)
    if (editing.value?.id === task.id) {
      editing.value = null
    }
  }, 'Tarea eliminada')
}

onMounted(loadTasks)
</script>

<template>
  <div class="page">
    <header class="page__header">
      <div>
        <h1 class="page__title">Task Manager</h1>
        <p class="page__subtitle">
          {{ pendingCount }} pendientes · {{ completedCount }} completadas
        </p>
      </div>
      <InstanceBadge />
    </header>

    <main class="page__content">
      <TaskForm :task="editing" :busy="busy" @submit="onSubmit" @cancel="editing = null" />
      <TaskList
        :tasks="tasks"
        :loading="loading"
        :busy="busy"
        @toggle="onToggle"
        @edit="editing = $event"
        @remove="onRemove"
      />
    </main>

    <ToastMessage :message="toast?.message ?? null" :type="toast?.type ?? 'success'" @close="toast = null" />
  </div>
</template>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
}

.page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.page__title {
  margin: 0;
  font-size: 1.75rem;
}

.page__subtitle {
  margin: 0.25rem 0 0;
  color: var(--muted);
}

.page__content {
  display: grid;
  grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 760px) {
  .page__content {
    grid-template-columns: 1fr;
  }
}
</style>
