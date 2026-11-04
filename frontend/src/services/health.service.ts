import type { InstanceInfo } from '@/types/task'
import { request } from './http'

export function getInstance(): Promise<InstanceInfo> {
  return request<InstanceInfo>('/instance')
}
