export type TaskStatus = 'PENDING' | 'COMPLETED'

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  createdAt: string
  updatedAt: string
}

export interface TaskInput {
  title: string
  description?: string
}

export interface InstanceInfo {
  instance: string
  hostname: string
}
