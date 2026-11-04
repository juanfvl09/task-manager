import { ref } from 'vue'

const API_BASE = '/api'

// Nombre de la instancia backend que atendió la última petición.
// Se lee de la cabecera X-Backend-Instance que añade NestJS.
export const lastInstance = ref<string | null>(null)

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const instance = response.headers.get('X-Backend-Instance')
  if (instance) {
    lastInstance.value = instance
  }

  if (!response.ok) {
    throw new ApiError(response.status, await extractMessage(response))
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function extractMessage(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (Array.isArray(body.message)) {
      return body.message.join(', ')
    }
    if (typeof body.message === 'string') {
      return body.message
    }
  } catch {
    // El cuerpo no es JSON, se usa el texto de estado.
  }
  return `${response.status} ${response.statusText}`
}
