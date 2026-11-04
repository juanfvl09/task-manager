import type { Task, TaskInput, TaskStatus } from '@/types/task'
import { request } from './http'

export function getTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks')
}

export function getTask(id: string): Promise<Task> {
  return request<Task>(`/tasks/${id}`)
}

export function createTask(input: TaskInput): Promise<Task> {
  return request<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateTask(id: string, input: Partial<TaskInput>): Promise<Task> {
  return request<Task>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  return request<Task>(`/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function deleteTask(id: string): Promise<void> {
  return request<void>(`/tasks/${id}`, { method: 'DELETE' })
}
