<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Task, TaskInput } from '@/types/task'

const props = defineProps<{
  task: Task | null
  busy: boolean
}>()

const emit = defineEmits<{
  submit: [input: TaskInput]
  cancel: []
}>()

const title = ref('')
const description = ref('')

watch(
  () => props.task,
  (task) => {
    title.value = task?.title ?? ''
    description.value = task?.description ?? ''
  },
  { immediate: true },
)

function onSubmit() {
  const trimmedTitle = title.value.trim()
  if (!trimmedTitle) {
    return
  }

  const input: TaskInput = { title: trimmedTitle }
  const trimmedDescription = description.value.trim()
  if (trimmedDescription) {
    input.description = trimmedDescription
  }

  emit('submit', input)

  if (!props.task) {
    title.value = ''
    description.value = ''
  }
}
</script>

<template>
  <form class="form" @submit.prevent="onSubmit">
    <h2 class="form__title">{{ task ? 'Editar tarea' : 'Nueva tarea' }}</h2>

    <label class="form__field">
      <span>Título</span>
      <input
        v-model="title"
        type="text"
        maxlength="150"
        required
        placeholder="¿Qué hay que hacer?"
        :disabled="busy"
      />
    </label>

    <label class="form__field">
      <span>Descripción</span>
      <textarea
        v-model="description"
        rows="3"
        placeholder="Detalles opcionales"
        :disabled="busy"
      ></textarea>
    </label>

    <div class="form__actions">
      <button class="button button--primary" type="submit" :disabled="busy || !title.trim()">
        {{ task ? 'Guardar cambios' : 'Crear tarea' }}
      </button>
      <button v-if="task" class="button" type="button" :disabled="busy" @click="emit('cancel')">
        Cancelar
      </button>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}

.form__title {
  margin: 0;
  font-size: 1.1rem;
}

.form__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: var(--muted);
}

.form__field input,
.form__field textarea {
  font: inherit;
  color: var(--text);
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--bg);
  resize: vertical;
}

.form__field input:focus,
.form__field textarea:focus {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
  border-color: var(--primary);
}

.form__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
</style>
