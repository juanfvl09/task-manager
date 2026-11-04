<script setup lang="ts">
import { ref } from 'vue'
import { getInstance } from '@/services/health.service'
import { lastInstance } from '@/services/http'

const hostname = ref<string | null>(null)
const loading = ref(false)

async function refresh() {
  loading.value = true
  try {
    const info = await getInstance()
    hostname.value = info.hostname
  } catch {
    hostname.value = null
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="badge">
    <span class="badge__dot" :class="{ 'badge__dot--off': !lastInstance }"></span>
    <span class="badge__text">
      <template v-if="lastInstance">
        Respondió <strong>{{ lastInstance }}</strong>
        <small v-if="hostname">({{ hostname }})</small>
      </template>
      <template v-else>Sin respuesta del backend</template>
    </span>
    <button class="badge__button" type="button" :disabled="loading" @click="refresh">
      {{ loading ? '...' : 'Consultar' }}
    </button>
  </div>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.6rem 0.35rem 0.75rem;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 0.875rem;
}

.badge__dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--success);
}

.badge__dot--off {
  background: var(--muted);
}

.badge__text small {
  color: var(--muted);
  margin-left: 0.25rem;
}

.badge__button {
  padding: 0.2rem 0.6rem;
  font-size: 0.8rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
}

.badge__button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
